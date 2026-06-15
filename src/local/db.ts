import Dexie, { type Table } from "dexie"
import type {
  Student,
  StudentDocument,
  Room,
  FeeRecord,
  Attendance,
  MovementLog,
  OutboxRecord,
  FileBlobRecord,
  SyncStateRecord,
  AppSettingRecord,
} from "./types"

/**
 * HostelDB: The primary local Dexie database for the HostelDesk PWA.
 * Operates entirely offline-first.
 */
export class HostelDB extends Dexie {
  // Synced tables
  students!: Table<Student, string>
  student_documents!: Table<StudentDocument, string>
  rooms!: Table<Room, string>
  fee_records!: Table<FeeRecord, string>
  attendance!: Table<Attendance, string>
  movement_logs!: Table<MovementLog, string>

  // Local-only tables
  outbox!: Table<OutboxRecord, string>
  file_blobs!: Table<FileBlobRecord, string>
  sync_state!: Table<SyncStateRecord, string>
  app_settings!: Table<AppSettingRecord, string>

  constructor() {
    super("HostelDB")

    // Define the schema for version 1.
    // Indexing rules:
    // 1. Only index properties used in where(), orderBy(), or unique constraints.
    // 2. The first property is always the primary key.
    // 3. '&' prefix means unique. '[' ']' denotes a compound index.
    this.version(1).stores({
      students: "id, owner_id, room_id, status, deleted, updated_at",
      student_documents: "id, owner_id, student_id, document_type, deleted, updated_at",
      rooms: "id, owner_id, deleted, updated_at",
      fee_records: "id, owner_id, student_id, due_date, status, deleted, updated_at",
      
      // Attendance indexes support:
      // - Unique row per student per day: &[student_id+date]
      // - Fetching all attendance for a date: date
      // - Filtering by status for a date: [date+status]
      attendance: "id, owner_id, &[student_id+date], date, [date+status], deleted, updated_at",
      
      // Movement indexes support:
      // - Check for current open logs per student: [student_id+is_open]
      // - Find all currently out: is_open
      // - Overdue queries: [is_open+expected_return_at]
      movement_logs: "id, owner_id, student_id, type, is_open, [student_id+is_open], [is_open+expected_return_at], deleted, updated_at",

      // Outbox FIFO queue indexes
      // - Order by sequence: sequence
      // - Pending/failed queries: [status+sequence]
      // - Lookups for specific entities: [entity_type+entity_id]
      outbox: "id, sequence, [status+sequence], [entity_type+entity_id]",
      
      // File blobs indexes
      file_blobs: "id, outbox_id, status",
      
      // Sync state uses table_name as the primary key
      sync_state: "table_name"
    })

    // Version 2: Add app_settings for security and auth config
    this.version(2).stores({
      students: "id, owner_id, room_id, status, deleted, updated_at",
      student_documents: "id, owner_id, student_id, document_type, deleted, updated_at",
      rooms: "id, owner_id, deleted, updated_at",
      fee_records: "id, owner_id, student_id, due_date, status, deleted, updated_at",
      attendance: "id, owner_id, &[student_id+date], date, [date+status], deleted, updated_at",
      movement_logs: "id, owner_id, student_id, type, is_open, [student_id+is_open], [is_open+expected_return_at], deleted, updated_at",
      outbox: "id, sequence, [status+sequence], [entity_type+entity_id]",
      file_blobs: "id, outbox_id, status",
      sync_state: "table_name",
      app_settings: "key"
    })

    // Version 3: Add notes and status to rooms, migrate floor to notes
    this.version(3).stores({
      students: "id, owner_id, room_id, status, deleted, updated_at",
      student_documents: "id, owner_id, student_id, document_type, deleted, updated_at",
      rooms: "id, owner_id, status, deleted, updated_at",
      fee_records: "id, owner_id, student_id, due_date, status, deleted, updated_at",
      attendance: "id, owner_id, &[student_id+date], date, [date+status], deleted, updated_at",
      movement_logs: "id, owner_id, student_id, type, is_open, [student_id+is_open], [is_open+expected_return_at], deleted, updated_at",
      outbox: "id, sequence, [status+sequence], [entity_type+entity_id]",
      file_blobs: "id, outbox_id, status",
      sync_state: "table_name",
      app_settings: "key"
    }).upgrade(tx => {
      // Migrate existing rooms: rename floor to notes, add status
      return tx.table("rooms").toCollection().modify(room => {
        if (room.notes === undefined) {
          room.notes = room.floor || null
        }
        delete room.floor
        if (!room.status) {
          room.status = "active"
        }
      })
    })
  }
}

// Export a singleton instance of the database
export const db = new HostelDB()
