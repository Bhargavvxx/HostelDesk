import { db } from "@/local/db"
import { supabase } from "@/cloud/supabase"
import { OutboxRecord } from "@/local/types"
import { processFileUpload } from "./files"

const SYNCED_FIELD_ALLOWLIST: Record<string, string[]> = {
  rooms: [
    "id", "owner_id", "room_number", "capacity",
    "notes", "status", "deleted", "created_at", "updated_at"
  ],
  students: [
    "id", "owner_id", "room_id", "first_name", "last_name",
    "phone", "emergency_contact", "address", "blood_group",
    "photo_path", "status", "deleted", "created_at", "updated_at"
  ],
  student_documents: [
    "id", "owner_id", "student_id", "document_type",
    "file_path", "deleted", "created_at", "updated_at"
  ],
  fee_records: [
    "id", "owner_id", "student_id", "amount_due", "amount_paid",
    "due_date", "payment_date", "payment_method", "status",
    "notes", "deleted", "created_at", "updated_at"
  ],
  attendance: [
    "id", "owner_id", "student_id", "date", "status",
    "notes", "deleted", "created_at", "updated_at"
  ],
  movement_logs: [
    "id", "owner_id", "student_id", "type", "is_open",
    "check_out_time", "check_in_time", "expected_return_at",
    "purpose", "destination", "deleted", "created_at", "updated_at"
  ],
}

// Strict table allowlist
const SYNCED_TABLES = Object.keys(SYNCED_FIELD_ALLOWLIST)

/**
 * Strips all local-only data before sending to Supabase.
 */
function sanitizePayload(tableName: string, rawPayload: any): any {
  if (!SYNCED_TABLES.includes(tableName)) {
    throw new Error(`Invalid table for push: ${tableName}`)
  }

  const allowlist = SYNCED_FIELD_ALLOWLIST[tableName]
  if (!allowlist) return rawPayload
  
  const sanitized: any = {}
  for (const key of allowlist) {
    if (key in rawPayload) {
      sanitized[key] = rawPayload[key]
    }
  }

  return sanitized
}

/**
 * Processes a single outbox item.
 */
export async function pushOutboxItem(item: OutboxRecord, ownerId: string): Promise<boolean> {
  try {
    // 1. Dependency Resolution
    if (item.depends_on) {
      const parentId = Array.isArray(item.depends_on) ? item.depends_on[0] : item.depends_on
      if (parentId) {
        const parent = await db.outbox.get(parentId)
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
