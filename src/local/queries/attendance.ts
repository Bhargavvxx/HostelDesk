import { db } from "@/local/db"
import { Attendance, MovementLog, OutboxRecord } from "@/local/types"
import { generateId, nowUTCISO } from "@/local/helpers"
import { getNextOutboxSequence } from "@/sync/sequence"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the id of the highest-sequence active outbox item across the
 * given entity IDs, or undefined if none.
 * Throws if any involved item is in conflict.
 */
async function getLatestActiveOutboxItem(entityIds: string[]): Promise<string | undefined> {
  const allItems: OutboxRecord[] = []
  for (const eid of entityIds) {
    const items = await db.outbox.where("entity_id").equals(eid).toArray()
    allItems.push(...items.filter(i =>
      ["pending", "syncing", "failed", "conflict"].includes(i.status)
    ))
  }

  if (allItems.some(i => i.status === "conflict")) {
    throw new Error("Cannot modify this record while there is a sync conflict. Please resolve it first.")
  }

  const latest = allItems.sort((a, b) => b.sequence - a.sequence)[0]
  return latest?.id
}

/**
 * Given a student's movement logs and an IST date string (YYYY-MM-DD),
 * determines if there is an overlapping overnight or home_visit log.
 * Pure function: does not query Dexie directly.
 */
export function getLeaveSuggestion(studentLogs: MovementLog[], dateIST: string): boolean {
  if (!studentLogs || studentLogs.length === 0) return false

  // IST day window in UTC
  const selectedStartUTC = new Date(`${dateIST}T00:00:00+05:30`).toISOString()
  
  // Next day 00:00:00 IST
  const nextDay = new Date(new Date(`${dateIST}T00:00:00+05:30`).getTime() + 86400000)
  const selectedEndUTC = nextDay.toISOString()

  return studentLogs.some(log => {
    if (log.deleted) return false
    if (log.type !== "overnight" && log.type !== "home_visit") return false

    const start = log.check_out_time
    // open-ended if both are null, meaning it extends infinitely into future
    const end = log.check_in_time || log.expected_return_at || "9999-12-31T23:59:59Z"

    // Overlap condition: start < windowEnd AND end > windowStart
    return start < selectedEndUTC && end > selectedStartUTC
  })
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

export interface MarkAttendanceInput {
  studentId: string
  date: string // YYYY-MM-DD (IST)
  status: Attendance["status"]
  notes?: string
}

export interface BulkAttendanceSelection {
  studentId: string
  status: Attendance["status"]
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function markAttendance(input: MarkAttendanceInput, ownerId: string): Promise<Attendance> {
  const now = nowUTCISO()

  return await db.transaction("rw", [db.students, db.attendance, db.outbox, db.app_settings], async () => {
    // 1. Strict Student Validation
    const student = await db.students.get(input.studentId)
    if (!student || student.deleted || student.status !== "active") {
      throw new Error("Student not found or inactive.")
    }

    // 2. Check for existing attendance record (single record per student per date)
    const existing = await db.attendance
      .where("student_id")
      .equals(input.studentId)
      .filter(a => a.date === input.date && !a.deleted)
      .first()

    const isUpdate = !!existing
    const recordId = existing ? existing.id : generateId()

    const record: Attendance = {
      id: recordId,
      owner_id: ownerId,
      student_id: input.studentId,
      date: input.date,
      status: input.status,
      notes: input.notes?.trim() || null,
      deleted: false,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
    }

    // 3. Resolve dependency
    const deps = [input.studentId]
    if (isUpdate) deps.push(recordId)
    const depends_on = await getLatestActiveOutboxItem(deps)

    // 4. Save to Dexie
    await db.attendance.put(record)

    // 5. Append to outbox
    const seq = await getNextOutboxSequence()
    await db.outbox.add({
      id: generateId(),
      sequence: seq,
      entity_type: "attendance",
      entity_id: recordId,
      operation: isUpdate ? "update" : "insert",
      payload: record,
      status: "pending",
      depends_on,
      attempts: 0,
      created_at: now,
      updated_at: now,
    })

    return record
  })
}

export async function bulkMarkAttendance(date: string, selections: BulkAttendanceSelection[], ownerId: string): Promise<void> {
  const now = nowUTCISO()

  await db.transaction("rw", [db.students, db.attendance, db.outbox, db.app_settings], async () => {
    
    // We will collect records and outbox items to bulkPut / bulkAdd
    const recordsToPut: Attendance[] = []
    const outboxItemsToAdd: OutboxRecord[] = []

    for (const sel of selections) {
      // 1. Strict Student Validation per student
      const student = await db.students.get(sel.studentId)
      if (!student || student.deleted || student.status !== "active") {
        throw new Error(`Cannot mark attendance: student ${sel.studentId} is not found or inactive.`)
      }

      // 2. Resolve dependency for this student insertion
      // Bulk mark only targets students WITHOUT existing records, so it's always an insert.
      // (If the UI passes a student who magically got a record in the meantime, we update it)
      const existing = await db.attendance
        .where("student_id")
        .equals(sel.studentId)
        .filter(a => a.date === date && !a.deleted)
        .first()

      const isUpdate = !!existing
      const recordId = existing ? existing.id : generateId()

      const deps = [sel.studentId]
      if (isUpdate) deps.push(recordId)
      const depends_on = await getLatestActiveOutboxItem(deps) // Will throw if conflict exists

      // 3. Build Record
      const record: Attendance = {
        id: recordId,
        owner_id: ownerId,
        student_id: sel.studentId,
        date: date,
        status: sel.status,
        notes: existing ? existing.notes : null,
        deleted: false,
        created_at: existing ? existing.created_at : now,
        updated_at: now,
      }
      recordsToPut.push(record)

      // 4. Build Outbox Item
      const seq = await getNextOutboxSequence()
      outboxItemsToAdd.push({
        id: generateId(),
        sequence: seq,
        entity_type: "attendance",
        entity_id: recordId,
        operation: isUpdate ? "update" : "insert",
        payload: record,
        status: "pending",
        depends_on,
        attempts: 0,
        created_at: now,
        updated_at: now,
      })
    }

    // Apply all in one go
    if (recordsToPut.length > 0) {
      await db.attendance.bulkPut(recordsToPut)
      await db.outbox.bulkAdd(outboxItemsToAdd)
    }
  })
}
