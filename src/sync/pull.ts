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
    // 2-second overlap window to prevent timestamp boundaries bugs
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
      // We still update the maxUpdatedAt so we don't query it again, 
      // but we let the outbox Push phase resolve the local overwrite.
    } else {
      // @ts-ignore dynamic table access
      await db[tableName].put(row)
    }

    if (row.updated_at > maxUpdatedAt) {
      maxUpdatedAt = row.updated_at
    }
  }

  // 4. Update sync state
  await db.sync_state.put({
    table_name: tableName,
    last_synced_at: maxUpdatedAt
  })
}
