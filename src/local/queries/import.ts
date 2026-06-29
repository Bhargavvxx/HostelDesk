import { db } from "../db"

/**
 * Helper to convert Base64 string to Blob
 */
const base64ToBlob = async (base64: string): Promise<Blob> => {
  const res = await fetch(base64)
  return res.blob()
}

/**
 * Validates the structure and content of a parsed JSON backup envelope.
 * Throws an Error if validation fails.
 */
export const validateBackup = (envelope: any) => {
  if (envelope.app !== "HostelDesk") {
    throw new Error("Invalid backup file: Not a HostelDesk backup.")
  }
  if (envelope.version !== 1) {
    throw new Error(`Unsupported backup version: ${envelope.version}`)
  }

  const expectedTables = [
    "app_settings",
    "students",
    "student_documents",
    "rooms",
    "fee_records",
    "attendance",
    "movement_logs",
    "outbox",
    "file_blobs",
    "sync_state"
  ]

  const tables = envelope.tables
  if (!tables || typeof tables !== "object") {
    throw new Error("Backup file is missing tables object.")
  }

  for (const tableName of expectedTables) {
    if (!Array.isArray(tables[tableName])) {
      throw new Error(`Backup file is missing table array for: ${tableName}`)
    }
  }

  // Validate every row is a plain object and validate major required IDs
  for (const tableName of expectedTables) {
    for (const row of tables[tableName]) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new Error(`Invalid row in table ${tableName}: not a plain object`)
      }

      switch (tableName) {
        case "students":
          if (!row.id) throw new Error("Student row missing id")
          break
        case "rooms":
          if (!row.id) throw new Error("Room row missing id")
          break
        case "fee_records":
          if (!row.id || !row.student_id) throw new Error("Fee record missing id or student_id")
          break
        case "attendance":
          if (!row.id || !row.student_id) throw new Error("Attendance record missing id or student_id")
          break
        case "movement_logs":
          if (!row.id || !row.student_id) throw new Error("Movement log missing id or student_id")
          break
        case "student_documents":
          if (!row.id || !row.student_id) throw new Error("Student document missing id or student_id")
          break
        case "outbox":
          if (!row.id) throw new Error("Outbox record missing id")
          break
        case "file_blobs":
          if (!row.id) throw new Error("File blob missing id")
          if (typeof row.base64_data !== "string") throw new Error("File blob missing base64_data string")
          break
      }
    }
  }
}

/**
 * Restores a validated JSON backup into Dexie.
 * Generates an emergency pre-restore backup first.
 * Runs entirely within a transaction and rolls back on failure.
 */
export const restoreFromJSON = async (envelope: any, createEmergencyBackup: () => Promise<void>) => {
  // 1. Validate the payload
  validateBackup(envelope)

  // 2. Generate emergency pre-restore backup
  await createEmergencyBackup()

  // 3. Prepare the file_blobs with actual Blobs instead of base64
  const tables = envelope.tables
  const preparedFileBlobs: any[] = []
  for (const record of tables.file_blobs) {
    const { base64_data, ...rest } = record
    let blob = null
    if (base64_data) {
      blob = await base64ToBlob(base64_data)
    }
    preparedFileBlobs.push({ ...rest, blob })
  }

  // 4. Perform the destructive restore within a single transaction
  // Using 'rw' mode to ensure rollback on any failure
  await db.transaction(
    "rw",
    [
      db.app_settings,
      db.rooms,
      db.students,
      db.student_documents,
      db.fee_records,
      db.attendance,
      db.movement_logs,
      db.file_blobs,
      db.outbox,
      db.sync_state,
    ],
    async () => {
      // Clear all tables first
      await db.app_settings.clear()
      await db.rooms.clear()
      await db.students.clear()
      await db.student_documents.clear()
      await db.fee_records.clear()
      await db.attendance.clear()
      await db.movement_logs.clear()
      await db.file_blobs.clear()
      await db.outbox.clear()
      await db.sync_state.clear()

      // bulkAdd in dependency-safe order
      if (tables.app_settings.length > 0) await db.app_settings.bulkAdd(tables.app_settings)
      if (tables.rooms.length > 0) await db.rooms.bulkAdd(tables.rooms)
      if (tables.students.length > 0) await db.students.bulkAdd(tables.students)
      if (tables.student_documents.length > 0) await db.student_documents.bulkAdd(tables.student_documents)
      if (tables.fee_records.length > 0) await db.fee_records.bulkAdd(tables.fee_records)
      if (tables.attendance.length > 0) await db.attendance.bulkAdd(tables.attendance)
      if (tables.movement_logs.length > 0) await db.movement_logs.bulkAdd(tables.movement_logs)
      if (preparedFileBlobs.length > 0) await db.file_blobs.bulkAdd(preparedFileBlobs)
      if (tables.outbox.length > 0) await db.outbox.bulkAdd(tables.outbox)
      if (tables.sync_state.length > 0) await db.sync_state.bulkAdd(tables.sync_state)
    }
  )
}
