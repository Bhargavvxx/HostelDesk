import { db } from "@/local/db"
import { MAX_ATTEMPTS } from "@/sync/push"
import { OutboxRecord } from "@/local/types"

/** Overwrite log entry shape (stored in app_settings). */
export interface OverwriteLogEntry {
  table: string
  id: string
  overwritten_at: string
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

/** All outbox items with status="conflict". */
export async function getConflictItems(): Promise<OutboxRecord[]> {
  return db.outbox.where("status").equals("conflict").sortBy("sequence")
}

/**
 * Outbox items that are "failed" AND have exhausted the automatic retry budget.
 * These need manual attention.
 */
export async function getHighAttemptFailedItems(): Promise<OutboxRecord[]> {
  const failed = await db.outbox.where("status").equals("failed").sortBy("sequence")
  return failed.filter(i => i.attempts >= MAX_ATTEMPTS)
}

/** Returns the overwrite log stored in app_settings, newest-first. */
export async function getOverwriteLog(): Promise<OverwriteLogEntry[]> {
  const record = await db.app_settings.get("overwrite_log")
  if (!record || !Array.isArray(record.value)) return []
  return (record.value as OverwriteLogEntry[]).slice().reverse()
}

// ─── Mutation helpers ─────────────────────────────────────────────────────────

/**
 * Permanently removes an outbox item after the user confirms they no longer
 * want to retry that local change. Does NOT modify any domain row.
 */
export async function removeOutboxItem(outboxId: string): Promise<void> {
  await db.outbox.delete(outboxId)
}

/**
 * Resets a high-attempt-failed outbox item back to "pending" with a fresh
 * retry budget, so the engine will auto-process it again.
 */
export async function retryOutboxItem(outboxId: string): Promise<void> {
  await db.outbox.update(outboxId, {
    status: "pending",
    attempts: 0,
    last_error: undefined,
  })
}

/**
 * Safely discards a local duplicate movement log that conflicted with a cloud
 * record (due to the Postgres partial unique index on open movement logs).
 *
 * The insert for this movement log never reached the cloud, so:
 * - We delete the conflict outbox item (nothing to undo on the cloud).
 * - We soft-delete the local movement log so it is hidden from the UI.
 * - We do NOT create a new outbox item (the cloud never knew about this log).
 */
export async function resolveMovementDuplicate(
  outboxId: string,
  movementLogId: string
): Promise<void> {
  const now = new Date().toISOString()

  await db.transaction("rw", db.outbox, db.movement_logs, async () => {
    // 1. Delete the conflict outbox item
    await db.outbox.delete(outboxId)

    // 2. Soft-delete the local duplicate movement log
    //    Setting is_open=false prevents accidental "Out Now" display.
    //    No new outbox item — the insert never reached the cloud.
    await db.movement_logs.update(movementLogId, {
      deleted: true,
      is_open: false,
      updated_at: now,
    })
  })
}
