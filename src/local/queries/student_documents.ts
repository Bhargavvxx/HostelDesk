import { db } from "@/local/db"
import { StudentDocument, FileBlobRecord, OutboxRecord } from "@/local/types"
import { generateId, nowUTCISO } from "@/local/helpers"
import { getNextOutboxSequence } from "@/sync/sequence"

export interface CreateDocumentInput {
  studentId: string
  documentType: "aadhar" | "id_proof" | "other"
  fileBlob: Blob
  mimeType: string
}

async function getLatestActiveOutboxItem(entities: [string, string][]): Promise<string | undefined> {
  const allItems: OutboxRecord[] = []
  for (const [eType, eId] of entities) {
    const items = await db.outbox.where("[entity_type+entity_id]").equals([eType, eId]).toArray()
    allItems.push(...items.filter(i => ["pending", "syncing", "failed", "conflict"].includes(i.status)))
  }
  const activeItems = allItems

  if (activeItems.some(i => i.status === "conflict")) {
    throw new Error("Cannot add documents while the student has a sync conflict. Please resolve the conflict first.")
  }

  const latest = activeItems.sort((a, b) => b.sequence - a.sequence)[0]
  return latest?.id
}

export async function createStudentDocument(data: CreateDocumentInput, ownerId: string): Promise<StudentDocument> {
  const docId = generateId()
  const fileBlobId = generateId()
  const now = nowUTCISO()

  const fileBlobRecord: FileBlobRecord = {
    id: fileBlobId,
    entity_type: "student_documents",
    entity_id: docId,
    field_name: "local_file_blob_id",
    blob: data.fileBlob,
    mime_type: data.mimeType,
    size_bytes: data.fileBlob.size,
    status: "local_only",
    created_at: now,
    updated_at: now,
  }

  const doc: StudentDocument = {
    id: docId,
    owner_id: ownerId,
    student_id: data.studentId,
    document_type: data.documentType,
    file_path: null,
    local_file_blob_id: fileBlobId,
    deleted: false,
    created_at: now,
    updated_at: now,
  }

  await db.transaction("rw", [db.student_documents, db.file_blobs, db.outbox, db.app_settings], async () => {
    const parentDependencyId = await getLatestActiveOutboxItem([["students", data.studentId]])

    await db.student_documents.put(doc)
    await db.file_blobs.put(fileBlobRecord)

    const docOutboxId = generateId()
    const docSeq = await getNextOutboxSequence()

    await db.outbox.add({
      id: docOutboxId,
      sequence: docSeq,
      entity_type: "student_documents",
      entity_id: docId,
      operation: "insert",
      payload: {
        ...doc,
        local_file_blob_id: undefined // Explicitly exclude
      },
      status: "pending",
      depends_on: parentDependencyId,
      attempts: 0,
      created_at: now,
      updated_at: now,
    })

    const uploadOutboxId = generateId()
    const uploadSeq = await getNextOutboxSequence()

    await db.outbox.add({
      id: uploadOutboxId,
      sequence: uploadSeq,
      entity_type: "student_documents",
      entity_id: docId,
      operation: "file_upload",
      payload: { local_file_blob_id: fileBlobId },
      status: "pending",
      depends_on: docOutboxId,
      attempts: 0,
      created_at: now,
      updated_at: now,
    })
  })

  return doc
}

export async function deleteStudentDocument(id: string, ownerId: string): Promise<void> {
  await db.transaction("rw", [db.student_documents, db.outbox, db.app_settings], async () => {
    const existing = await db.student_documents.get(id)
    if (!existing || existing.deleted || existing.owner_id !== ownerId) return

    const now = nowUTCISO()
    await db.student_documents.update(id, { deleted: true, updated_at: now })
    
    // Deleting a document does not strictly depend on the student's status, 
    // but the engine will process it in sequence anyway.
    
    const seq = await getNextOutboxSequence()
    await db.outbox.add({
      id: generateId(),
      sequence: seq,
      entity_type: "student_documents",
      entity_id: id,
      operation: "delete",
      payload: { id },
      status: "pending",
      attempts: 0,
      created_at: now,
      updated_at: now,
    })
  })
}
