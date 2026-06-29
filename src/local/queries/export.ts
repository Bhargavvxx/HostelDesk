import { db } from "../db"
import Papa from "papaparse"
import * as XLSX from "xlsx"

// Helper to convert Blob to Base64 data URL
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Download helper
const downloadFile = (content: string | Blob, filename: string, mimeType: string) => {
  const blob = typeof content === "string" ? new Blob([content], { type: mimeType }) : content
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Generate a full JSON backup of the local database.
 */
export const exportFullJSON = async () => {
  const tables = {
    app_settings: await db.app_settings.toArray(),
    students: await db.students.toArray(),
    student_documents: await db.student_documents.toArray(),
    rooms: await db.rooms.toArray(),
    fee_records: await db.fee_records.toArray(),
    attendance: await db.attendance.toArray(),
    movement_logs: await db.movement_logs.toArray(),
    outbox: await db.outbox.toArray(),
    file_blobs: [] as any[],
    sync_state: await db.sync_state.toArray(),
  }

  // Handle file blobs specifically to convert blobs to base64
  const rawFileBlobs = await db.file_blobs.toArray()
  for (const record of rawFileBlobs) {
    let base64_data = ""
    if (record.blob) {
      base64_data = await blobToBase64(record.blob)
    }
    const { blob, ...rest } = record
    tables.file_blobs.push({
      ...rest,
      base64_data,
    })
  }

  const envelope = {
    app: "HostelDesk",
    version: 1,
    exported_at: new Date().toISOString(),
    tables,
  }

  const jsonString = JSON.stringify(envelope, null, 2)
  const filename = `HostelDesk_backup_${new Date().toISOString().split("T")[0]}.json`
  downloadFile(jsonString, filename, "application/json")
}

const REPORTING_TABLES = [
  "students",
  "student_documents",
  "rooms",
  "fee_records",
  "attendance",
  "movement_logs",
] as const

/**
 * Export reporting tables sequentially as CSVs
 */
export const exportCSVs = async () => {
  const dateStr = new Date().toISOString().split("T")[0]

  for (const tableName of REPORTING_TABLES) {
    const table = db.table(tableName)
    const records = await table.toArray()
    if (records.length === 0) continue

    const csvStr = Papa.unparse(records)
    downloadFile(csvStr, `HostelDesk_${tableName}_${dateStr}.csv`, "text/csv")
    
    // Slight delay to ensure sequential downloads don't get blocked
    await new Promise(r => setTimeout(r, 200))
  }
}

/**
 * Export reporting tables as a single Excel workbook
 */
export const exportExcel = async () => {
  const wb = XLSX.utils.book_new()
  const dateStr = new Date().toISOString().split("T")[0]

  for (const tableName of REPORTING_TABLES) {
    const table = db.table(tableName)
    const records = await table.toArray()
    if (records.length === 0) continue

    const ws = XLSX.utils.json_to_sheet(records)
    XLSX.utils.book_append_sheet(wb, ws, tableName)
  }

  if (wb.SheetNames.length === 0) {
    throw new Error("No data found to export.")
  }

  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  downloadFile(blob, `HostelDesk_export_${dateStr}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
}
