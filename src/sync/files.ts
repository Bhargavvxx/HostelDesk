import { db } from "@/local/db"
import { supabase } from "@/cloud/supabase"
import { OutboxRecord } from "@/local/types"

export async function processFileUpload(item: OutboxRecord, ownerId: string): Promise<any> {
  const fileBlobId = item.payload.local_file_blob_id
  if (!fileBlobId) throw new Error("Missing local_file_blob_id in outbox payload")

  const fileBlob = await db.file_blobs.get(fileBlobId)
  if (!fileBlob || !fileBlob.blob) {
    throw new Error(`File blob ${fileBlobId} not found locally`)
  }

  // Determine path logic (photo vs document)
  let storagePath = ""
  if (item.entity_type === "students") {
    storagePath = `${ownerId}/students/${item.entity_id}/photo.jpg`
  } else if (item.entity_type === "student_documents") {
    storagePath = `${ownerId}/documents/${item.entity_id}/file.jpg`
  } else {
    throw new Error(`Unknown entity type for file upload: ${item.entity_type}`)
  }

  // 1. Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("hosteldesk-files")
    .upload(storagePath, fileBlob.blob, {
      upsert: true,
      contentType: fileBlob.mime_type
    })

  if (uploadError) throw uploadError

  // 2. Update Cloud Row
  const updatePayload = item.entity_type === "students" 
    ? { photo_path: storagePath }
    : { file_path: storagePath }

  const { data: cloudRow, error: updateError } = await supabase
    .from(item.entity_type)
    .update(updatePayload)
    .eq("id", item.entity_id)
    .select()
    .single()

  if (updateError) throw updateError

  // 3. Mark file blob synced (we delete it to save space, or mark it synced)
  await db.file_blobs.update(fileBlobId, { status: "synced", blob: undefined })

  return cloudRow
}
