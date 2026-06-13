import { db } from "@/local/db"
import { supabase } from "@/cloud/supabase"
import { OutboxRecord } from "@/local/types"
import { processFileUpload } from "./files"

// Strict table allowlist
const SYNCED_TABLES = [
  "rooms",
  "students",
  "student_documents",
  "fee_records",
  "attendance",
  "movement_logs"
] as const

/**
 * Strips all local-only data before sending to Supabase.
 */
function sanitizePayload(tableName: string, rawPayload: any): any {
  if (!SYNCED_TABLES.includes(tableName as any)) {
    throw new Error(`Invalid table for push: ${tableName}`)
  }

  const payload = { ...rawPayload }

  // Explicitly remove local-only blob refs and arbitrary objects
  delete payload.local_photo_blob_id
  delete payload.local_file_blob_id
  delete payload.blob

  return payload
}

/**
 * Processes a single outbox item.
 */
export async function pushOutboxItem(item: OutboxRecord, ownerId: string): Promise<boolean> {
  try {
    // 1. Dependency Resolution
    if (item.depends_on) {
      const parent = await db.outbox.get(item.depends_on)
      if (parent) {
        if (parent.status === "conflict") {
          // Parent failed permanently, cascade conflict
          await db.outbox.update(item.id, {
            status: "conflict",
            last_error: "Blocked by parent conflict"
          })
          return false
        }
        // Parent is still pending/syncing/failed(retryable). We must wait.
        return false
      }
    }

    // Mark as syncing
    await db.outbox.update(item.id, { status: "syncing", attempts: item.attempts + 1 })

    let cloudRow: any = null

    // 2. Handle Operation
    if (item.operation === "file_upload") {
      cloudRow = await processFileUpload(item, ownerId)
    } 
    else if (item.operation === "insert" || item.operation === "update") {
      const sanitized = sanitizePayload(item.entity_type, item.payload)
      const { data, error } = await supabase
        .from(item.entity_type)
        .upsert({ ...sanitized, owner_id: ownerId })
        .select()
        .single()
      
      if (error) throw error
      cloudRow = data
    } 
    else if (item.operation === "delete") {
      // Soft delete
      const { data, error } = await supabase
        .from(item.entity_type)
        .update({ deleted: true, owner_id: ownerId })
        .eq("id", item.entity_id)
        .eq("owner_id", ownerId) // safety
        .select()
        .single()

      if (error) throw error
      cloudRow = data
    }

    // 3. Read-Back: Update local Dexie with server-stamped row
    if (cloudRow && SYNCED_TABLES.includes(item.entity_type as any)) {
      // @ts-ignore - dynamic table access
      await db[item.entity_type].put(cloudRow)
    }

    // 4. Success: Remove outbox item
    await db.outbox.delete(item.id)
    return true

  } catch (error: any) {
    console.error(`Outbox push failed for ${item.id}`, error)
    
    // Auth failures should stop everything, not mark as conflict
    if (error.status === 401 || error.status === 403 || error.message?.includes("JWT")) {
      await db.outbox.update(item.id, { status: "failed", last_error: error.message })
      throw error // Re-throw so the engine catches it and stops
    }

    // Postgres Constraint Failures (Conflict)
    if (error.code && (error.code.startsWith("23") || error.code === "PGRST116")) { 
      // Class 23 — Integrity Constraint Violation
      await db.outbox.update(item.id, { status: "conflict", last_error: error.message })
      return false
    }

    // Generic network/retryable failure
    await db.outbox.update(item.id, { status: "failed", last_error: error.message })
    return false
  }
}
