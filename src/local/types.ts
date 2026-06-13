/**
 * TypeScript definitions for the local Dexie database schemas.
 * These largely mirror the Postgres Supabase schemas, adding local-only fields
 * for queues and file references.
 */

/* ─── Synced Tables (Mirrors of Postgres) ───────────────────────────── */

export interface Student {
  id: string
  owner_id: string
  room_id: string | null
  first_name: string
  last_name: string
  phone: string
  emergency_contact: string
  address: string | null
  blood_group: string | null
  photo_path: string | null
  local_photo_blob_id: string | null // Local-only reference to file_blobs
  status: "active" | "archived"
  deleted: boolean
  created_at: string
  updated_at: string
}

export interface StudentDocument {
  id: string
  owner_id: string
  student_id: string
  document_type: "aadhar" | "id_proof" | "other"
  file_path: string | null
  local_file_blob_id: string | null // Local-only reference to file_blobs
  deleted: boolean
  created_at: string
  updated_at: string
}

export interface Room {
  id: string
  owner_id: string
  room_number: string
  capacity: number
  floor: string | null
  deleted: boolean
  created_at: string
  updated_at: string
}

export interface FeeRecord {
  id: string
  owner_id: string
  student_id: string
  amount_due: number
  amount_paid: number
  due_date: string | null // YYYY-MM-DD or null
  payment_date: string | null // YYYY-MM-DD or null
  payment_method: "cash" | "upi" | "bank" | "other" | null
  status: "pending" | "partial" | "paid"
  notes: string | null
  deleted: boolean
  created_at: string
  updated_at: string
}

export interface Attendance {
  id: string
  owner_id: string
  student_id: string
  date: string // YYYY-MM-DD (IST)
  status: "present" | "absent" | "leave" | "late"
  notes: string | null
  deleted: boolean
  created_at: string
  updated_at: string
}

export interface MovementLog {
  id: string
  owner_id: string
  student_id: string
  type: "out_pass" | "overnight" | "home_visit"
  is_open: boolean
  check_out_time: string // ISO UTC
  check_in_time: string | null // ISO UTC or null
  expected_return_at: string // ISO UTC
  purpose: string | null
  destination: string | null
  deleted: boolean
  created_at: string
  updated_at: string
}

/* ─── Local-Only Sync Queues & State ────────────────────────────────── */

/**
 * Outbox: A FIFO queue of mutations waiting to be pushed to the cloud.
 * Completed records will be deleted immediately to minimize local storage.
 * Therefore, the 'done' status is omitted.
 */
export interface OutboxRecord {
  id: string
  sequence: number // Used for explicit FIFO ordering
  entity_type: string // "students", "fee_records", etc., or "file_upload"
  entity_id: string
  operation: "insert" | "update" | "delete" | "file_upload"
  payload: any
  status: "pending" | "syncing" | "failed" | "conflict"
  depends_on?: string[] // Parent IDs this record must wait for
  attempts: number
  last_error?: string
  created_at: string
  updated_at: string
}

/**
 * File Blobs: Temporary storage for user-selected files (e.g., photos)
 * before they are successfully uploaded to Supabase Storage.
 */
export interface FileBlobRecord {
  id: string
  outbox_id?: string
  entity_type: "students" | "student_documents"
  entity_id: string
  field_name: string // e.g., 'local_photo_blob_id'
  blob: Blob
  mime_type: string
  size_bytes: number
  status: "local_only" | "uploading" | "synced" | "failed"
  cloud_path?: string
  last_error?: string
  created_at: string
  updated_at: string
}

/**
 * Sync State: Tracks the last time each table was successfully pulled
 * from the cloud, enabling efficient delta syncs.
 */
export interface SyncStateRecord {
  table_name: string // Primary key: 'students', 'rooms', etc.
  last_synced_at: string // ISO UTC timestamp of the last successful pull
}
