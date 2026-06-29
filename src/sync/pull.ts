import { db } from "@/local/db"
import { supabase } from "@/cloud/supabase"

// Pull tables in explicit dependency order
const PULL_TABLES = [
  "rooms",
  "students",
  "student_documents",
  "fee_records",
  "attendance",
  "movement_logs"
] as const

const OVERWRITE_LOG_KEY = "overwrite_log"
const OVERWRITE_LOG_MAX = 20

export async function pullChanges(ownerId: string): Promise<void> {
  for (const table of PULL_TABLES) {
    await pullTable(table, ownerId)
  }
}

async function pullTable(tableName: string, ownerId: string) {
  // 1. Get last synced timestamp
  const syncState = await db.sync_state.get(tableName)
  let queryAt = new Date(0).toISOString()
  
  if (syncState && syncState.last_synced_at) {
    // 2-second overlap window to prevent timestamp boundary bugs
    const lastDate = new Date(syncState.last_synced_at)
    lastDate.setSeconds(lastDate.getSeconds() - 2)
    queryAt = lastDate.toISOString()
  }

  // 2. Fetch from Supabase
  // Note: No filter on `deleted=false`. We intentionally fetch soft-deleted tombstones.
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq("owner_id", ownerId)
    .gte("updated_at", queryAt)
    .order("updated_at", { ascending: true })

  if (error) {
    if ((error as any).status === 401 || (error as any).status === 403 || error.message?.includes("JWT")) {
      throw error // Let engine halt
    }
    console.error(`Failed to pull ${tableName}`, error)
    return
  }

  if (!data || data.length === 0) return

  // 3. Apply to Dexie carefully
  let maxUpdatedAt = queryAt

  for (const row of data) {
    // Check if there is an active outbox item for this row.
    // If we have local pending changes, DO NOT overwrite with cloud data yet.
    const activeOutbox = await db.outbox
      .where("[entity_type+entity_id]")
      .equals([tableName, row.id])
      .toArray()
      
    const hasPendingLocal = activeOutbox.some(o => 
      o.status === "pending" || 
      o.status === "syncing" || 
      o.status === "failed" || 
      o.status === "conflict"
    )

    if (hasPendingLocal) {
      console.warn(`Skipping pull for ${tableName}:${row.id} due to active local outbox items.`)
      // A skipped row MUST NOT advance the checkpoint. If the local outbox item is later removed, 
      // we need to be able to fetch this cloud row again.
    } else {
      // Check if this pull overwrites an existing local row with a different updated_at.
      // Exact condition: row exists locally AND updated_at differs AND no active outbox (already checked above).
      try {
        // @ts-ignore dynamic table access
        const existingRow = await db[tableName].get(row.id)
        if (existingRow && existingRow.updated_at !== row.updated_at) {
          await appendOverwriteLog(tableName, row.id)
        }
      } catch {
        // Non-critical — don't let overwrite log failure block the pull
      }

      // @ts-ignore dynamic table access
      await db[tableName].put(row)
      
      // ONLY advance the sync checkpoint for rows that are actually applied locally
      if (row.updated_at > maxUpdatedAt) {
        maxUpdatedAt = row.updated_at
      }
    }
  }

  // 4. Update sync state
  await db.sync_state.put({
    table_name: tableName,
    last_synced_at: maxUpdatedAt
  })
}

/**
 * Appends an entry to the overwrite log stored in app_settings.
 * Keeps only the last OVERWRITE_LOG_MAX entries.
 * Stores no sensitive data — only table name, row ID, and timestamp.
 */
async function appendOverwriteLog(tableName: string, rowId: string) {
  const now = new Date().toISOString()
  const logRecord = await db.app_settings.get(OVERWRITE_LOG_KEY)
  const existing: any[] = Array.isArray(logRecord?.value) ? (logRecord.value as any[]) : []

  const updated = [
    ...existing,
    { table: tableName, id: rowId, overwritten_at: now }
  ].slice(-OVERWRITE_LOG_MAX)

  await db.app_settings.put({
    key: OVERWRITE_LOG_KEY,
    value: updated,
    created_at: logRecord?.created_at ?? now,
    updated_at: now
  })
}
