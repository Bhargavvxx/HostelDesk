import { db } from "@/local/db"
import { MovementLog, OutboxRecord } from "@/local/types"
import { generateId, nowUTCISO } from "@/local/helpers"
import { getNextOutboxSequence } from "@/sync/sequence"

// ─── Public helper ────────────────────────────────────────────────────────────

export type MovementStatus = "in" | "out" | "overdue"

/**
 * Computes the movement status based on a single open movement log.
 * Pure function: compares expected_return_at against the provided now string.
 */
export function computeMovementStatus(
  openLog: MovementLog | undefined,
  currentUTCISO: string
): MovementStatus {
  if (!openLog || !openLog.is_open) return "in"
  if (openLog.expected_return_at && openLog.expected_return_at < currentUTCISO) {
    return "overdue"
  }
  return "out"
}

// ─── Dependency resolution ────────────────────────────────────────────────────

/**
 * Returns the id of the highest-sequence active outbox item across the
 * given entity IDs, or undefined if none.
 * Throws if any involved item is in conflict.
 */
async function getLatestActiveOutboxItem(entities: [string, string][]): Promise<string | undefined> {
  const allItems: OutboxRecord[] = []
  for (const [eType, eId] of entities) {
    const items = await db.outbox.where("[entity_type+entity_id]").equals([eType, eId]).toArray()
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

// ─── Inputs ───────────────────────────────────────────────────────────────────

export interface CheckOutInput {
  studentId: string
  type: "out_pass" | "overnight" | "home_visit"
  expectedReturnAt: string | null // ISO UTC
  purpose: string | null
  destination: string | null
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function checkOut(data: CheckOutInput, ownerId: string): Promise<MovementLog> {
  const now = nowUTCISO()

  // Strict Validation
  if (data.expectedReturnAt && data.expectedReturnAt < now) {
    throw new Error("Expected return time cannot be in the past.")
  }

  const logId = generateId()
  const record: MovementLog = {
    id: logId,
    owner_id: ownerId,
    student_id: data.studentId,
    type: data.type,
    is_open: true,
    check_out_time: now,
    check_in_time: null,
    expected_return_at: data.expectedReturnAt,
    purpose: data.purpose?.trim() || null,
    destination: data.destination?.trim() || null,
    deleted: false,
    created_at: now,
    updated_at: now,
  }

  await db.transaction("rw", [db.students, db.movement_logs, db.outbox, db.app_settings], async () => {
    // 1. Validate student exists and is active
    const student = await db.students.get(data.studentId)
    if (!student || student.deleted || student.status !== "active") {
      throw new Error("Student not found or inactive.")
    }

    // 2. Local safeguard: ensure no existing open log for this student
    const openLogs = await db.movement_logs
      .where("student_id")
      .equals(data.studentId)
      .filter(l => l.is_open && !l.deleted)
      .count()

    if (openLogs > 0) {
      throw new Error("Student already has an open movement log.")
    }

    // 3. Resolve dependency (student only)
    const depends_on = await getLatestActiveOutboxItem([["students", data.studentId]])

    // 4. Save to Dexie
    await db.movement_logs.put(record)

    // 5. Append to outbox
    const seq = await getNextOutboxSequence()
    await db.outbox.add({
      id: generateId(),
      sequence: seq,
      entity_type: "movement_logs",
      entity_id: logId,
      operation: "insert",
      payload: record,
      status: "pending",
      depends_on,
      attempts: 0,
      created_at: now,
      updated_at: now,
    })
  })

  return record
}

export async function checkIn(logId: string, ownerId: string): Promise<MovementLog> {
  const now = nowUTCISO()

  return await db.transaction("rw", [db.movement_logs, db.outbox, db.app_settings], async () => {
    const existing = await db.movement_logs.get(logId)
    if (!existing || existing.deleted || existing.owner_id !== ownerId) {
      throw new Error("Movement log not found.")
    }
    if (!existing.is_open) {
      throw new Error("Movement log is already closed.")
    }

    // Strict Validation
    if (now < existing.check_out_time) {
      throw new Error("Check-in time cannot be before check-out time.")
    }

    const updated: MovementLog = {
      ...existing,
      is_open: false,
      check_in_time: now,
      updated_at: now,
    }

    // Resolve dependency (student and log)
    const depends_on = await getLatestActiveOutboxItem([
      ["students", existing.student_id], 
      ["movement_logs", logId]
    ])

    // Save to Dexie
    await db.movement_logs.put(updated)

    // Append to outbox
    const seq = await getNextOutboxSequence()
    await db.outbox.add({
      id: generateId(),
      sequence: seq,
      entity_type: "movement_logs",
      entity_id: logId,
      operation: "update",
      payload: updated,
      status: "pending",
      depends_on,
      attempts: 0,
      created_at: now,
      updated_at: now,
    })

    return updated
  })
}
