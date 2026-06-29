import { db } from "@/local/db"
import { FeeRecord } from "@/local/types"
import { generateId, nowUTCISO, getISTDateKey } from "@/local/helpers"
import { getNextOutboxSequence } from "@/sync/sequence"

// ─── Public helper ────────────────────────────────────────────────────────────

/**
 * The single authoritative overdue formula.
 * Used by the Fees screen AND the Students overdue map — never duplicated.
 */
export function computeStudentFeeStats(records: FeeRecord[], todayIST: string) {
  const active = records.filter(r => !r.deleted)
  const totalDue = active.reduce((s, r) => s + r.amount_due, 0)
  const totalPaid = active.reduce((s, r) => s + r.amount_paid, 0)
  const studentBalance = totalDue - totalPaid // negative = credit

  const pastDueDue = active
    .filter(r => r.due_date !== null && r.due_date < todayIST)
    .reduce((s, r) => s + r.amount_due, 0)
  const overdueBalance = pastDueDue - totalPaid // all payments offset past-due first

  return {
    totalDue,
    totalPaid,
    studentBalance,
    overdueBalance,
    isOverdue: overdueBalance > 0,
  }
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

export interface CreateFeeInput {
  studentId: string
  amountDue: number
  amountPaid: number
  dueDate: string | null       // YYYY-MM-DD
  paymentDate: string | null   // YYYY-MM-DD (defaults to today IST if amountPaid > 0)
  paymentMethod: "cash" | "upi" | "bank" | "other" | null
  notes: string | null
}

export interface UpdateFeeInput {
  amountDue: number
  amountPaid: number
  dueDate: string | null
  paymentDate: string | null
  paymentMethod: "cash" | "upi" | "bank" | "other" | null
  notes: string | null
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateFee(amountDue: number, amountPaid: number, dueDate: string | null, paymentMethod: string | null) {
  if (amountDue < 0) throw new Error("Amount due cannot be negative.")
  if (amountPaid < 0) throw new Error("Amount paid cannot be negative.")
  if (amountDue === 0 && amountPaid === 0) throw new Error("Enter either an amount due or an amount paid.")
  if (amountDue > 0 && !dueDate) throw new Error("Due date is required when amount due is set.")
  if (amountPaid > 0 && !paymentMethod) throw new Error("Payment method is required when amount paid is set.")
}

function deriveStatus(amountDue: number, amountPaid: number): "pending" | "partial" | "paid" {
  if (amountPaid >= amountDue) return "paid"
  if (amountPaid > 0) return "partial"
  return "pending"
}

// ─── Dependency resolution ────────────────────────────────────────────────────

/**
 * Returns the id of the highest-sequence active outbox item across the
 * given entity IDs, or undefined if none.
 * Throws if any involved item is in conflict — the caller should surface this error.
 */
async function getLatestActiveOutboxItem(entities: [string, string][]): Promise<string | undefined> {
  const allItems = []
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

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createFee(data: CreateFeeInput, ownerId: string): Promise<FeeRecord> {
  const todayIST = getISTDateKey()

  // Resolve payment_date default
  const paymentDate = data.amountPaid > 0
    ? (data.paymentDate || todayIST)
    : null

  validateFee(data.amountDue, data.amountPaid, data.dueDate, data.paymentMethod)

  const feeId = generateId()
  const now = nowUTCISO()
  const status = deriveStatus(data.amountDue, data.amountPaid)

  const record: FeeRecord = {
    id: feeId,
    owner_id: ownerId,
    student_id: data.studentId,
    amount_due: data.amountDue,
    amount_paid: data.amountPaid,
    due_date: data.dueDate,
    payment_date: paymentDate,
    payment_method: data.amountPaid > 0 ? data.paymentMethod : null,
    status,
    notes: data.notes?.trim() || null,
    deleted: false,
    created_at: now,
    updated_at: now,
  }

  await db.transaction("rw", [db.fee_records, db.outbox, db.app_settings], async () => {
    // createFee: only check student parent dependency
    const depends_on = await getLatestActiveOutboxItem([["students", data.studentId]])

    await db.fee_records.put(record)

    const seq = await getNextOutboxSequence()
    await db.outbox.add({
      id: generateId(),
      sequence: seq,
      entity_type: "fee_records",
      entity_id: feeId,
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

export async function updateFee(id: string, data: UpdateFeeInput, ownerId: string): Promise<FeeRecord> {
  const existing = await db.fee_records.get(id)
  if (!existing || existing.deleted || existing.owner_id !== ownerId) throw new Error("Fee record not found.")

  const todayIST = getISTDateKey()
  const paymentDate = data.amountPaid > 0
    ? (data.paymentDate || todayIST)
    : null

  validateFee(data.amountDue, data.amountPaid, data.dueDate, data.paymentMethod)

  const now = nowUTCISO()
  const status = deriveStatus(data.amountDue, data.amountPaid)

  const updated: FeeRecord = {
    ...existing,
    amount_due: data.amountDue,
    amount_paid: data.amountPaid,
    due_date: data.dueDate,
    payment_date: paymentDate,
    payment_method: data.amountPaid > 0 ? data.paymentMethod : null,
    status,
    notes: data.notes?.trim() || null,
    updated_at: now,
  }

  return await db.transaction("rw", [db.fee_records, db.outbox, db.app_settings], async () => {
    // updateFee: check both student and fee record outbox
    const depends_on = await getLatestActiveOutboxItem([
      ["students", existing.student_id], 
      ["fee_records", id]
    ])

    await db.fee_records.put(updated)

    const seq = await getNextOutboxSequence()
    await db.outbox.add({
      id: generateId(),
      sequence: seq,
      entity_type: "fee_records",
      entity_id: id,
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

export async function deleteFee(id: string, ownerId: string): Promise<void> {
  await db.transaction("rw", [db.fee_records, db.outbox, db.app_settings], async () => {
    const existing = await db.fee_records.get(id)
    if (!existing || existing.deleted || existing.owner_id !== ownerId) return

    // deleteFee: check both student and fee record outbox
    const depends_on = await getLatestActiveOutboxItem([
      ["students", existing.student_id], 
      ["fee_records", id]
    ])

    const now = nowUTCISO()
    await db.fee_records.update(id, { deleted: true, updated_at: now })

    const seq = await getNextOutboxSequence()
    await db.outbox.add({
      id: generateId(),
      sequence: seq,
      entity_type: "fee_records",
      entity_id: id,
      operation: "delete",
      payload: { id },
      status: "pending",
      depends_on,
      attempts: 0,
      created_at: now,
      updated_at: now,
    })
  })
}
