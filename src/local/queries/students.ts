import { db } from "@/local/db"
import { Student, FileBlobRecord } from "@/local/types"
import { generateId, nowUTCISO } from "@/local/helpers"
import { getNextOutboxSequence } from "@/sync/sequence"
import { getRoomOccupancy, getRoomById } from "@/local/queries/rooms"

export interface CreateStudentInput {
  firstName: string
  lastName: string
  phone: string
  emergencyContact: string
  address?: string | null
  bloodGroup?: string | null
  roomId?: string | null
  photoBlob?: Blob | null
  photoMimeType?: string | null
}

export interface UpdateStudentInput {
  firstName: string
  lastName: string
  phone: string
  emergencyContact: string
  address?: string | null
  bloodGroup?: string | null
  roomId?: string | null
  photoBlob?: Blob | null
  photoMimeType?: string | null
}

async function getLatestActiveOutboxItem(entityId: string): Promise<string | undefined> {
  const pendingItems = await db.outbox.where("entity_id").equals(entityId).toArray()
  const activeItems = pendingItems.filter(i => ["pending", "syncing", "failed", "conflict"].includes(i.status))

  if (activeItems.some(i => i.status === "conflict")) {
    throw new Error("Cannot modify files while the record has a sync conflict. Please resolve the conflict first.")
  }

  const latest = activeItems.sort((a, b) => b.sequence - a.sequence)[0]
  return latest?.id
}

export async function createStudent(data: CreateStudentInput, ownerId: string): Promise<Student> {
  if (data.roomId) {
    const room = await getRoomById(data.roomId)
    if (!room) throw new Error("Room not found")
    const occupancy = await getRoomOccupancy(data.roomId)
    if (occupancy >= room.capacity) throw new Error(`Room ${room.room_number} is full`)
  }

  const studentId = generateId()
  const now = nowUTCISO()

  let fileBlobId: string | null = null
  let fileBlobRecord: FileBlobRecord | null = null

  if (data.photoBlob && data.photoMimeType) {
    fileBlobId = generateId()
    fileBlobRecord = {
      id: fileBlobId,
      entity_type: "students",
      entity_id: studentId,
      field_name: "local_photo_blob_id",
      blob: data.photoBlob,
      mime_type: data.photoMimeType,
      size_bytes: data.photoBlob.size,
      status: "local_only",
      created_at: now,
      updated_at: now,
    }
  }

  const student: Student = {
    id: studentId,
    owner_id: ownerId,
    room_id: data.roomId || null,
    first_name: data.firstName.trim(),
    last_name: data.lastName.trim(),
    phone: data.phone.trim(),
    emergency_contact: data.emergencyContact.trim(),
    address: data.address?.trim() || null,
    blood_group: data.bloodGroup || null,
    photo_path: null,
    local_photo_blob_id: fileBlobId,
    status: "active",
    deleted: false,
    created_at: now,
    updated_at: now,
  }

  await db.transaction("rw", [db.students, db.file_blobs, db.outbox, db.app_settings], async () => {
    await db.students.put(student)

    if (fileBlobRecord) {
      await db.file_blobs.put(fileBlobRecord)
    }

    const sequence = await getNextOutboxSequence()
    const studentOutboxId = generateId()

    await db.outbox.add({
      id: studentOutboxId,
      sequence,
      entity_type: "students",
      entity_id: studentId,
      operation: "insert",
      payload: { 
        ...student, 
        local_photo_blob_id: undefined // Explicitly strip
      },
      status: "pending",
      attempts: 0,
      created_at: now,
      updated_at: now,
    })

    if (fileBlobRecord) {
      const uploadSeq = await getNextOutboxSequence()
      await db.outbox.add({
        id: generateId(),
        sequence: uploadSeq,
        entity_type: "students",
        entity_id: studentId,
        operation: "file_upload",
        payload: { local_file_blob_id: fileBlobRecord.id },
        status: "pending",
        depends_on: studentOutboxId,
        attempts: 0,
        created_at: now,
        updated_at: now,
      })
    }
  })

  return student
}

export async function updateStudent(id: string, data: UpdateStudentInput, ownerId: string): Promise<Student> {
  const existing = await db.students.get(id)
  if (!existing || existing.deleted || existing.owner_id !== ownerId) throw new Error("Student not found")

  if (data.roomId && data.roomId !== existing.room_id) {
    const room = await getRoomById(data.roomId)
    if (!room) throw new Error("Room not found")
    const occupancy = await getRoomOccupancy(data.roomId)
    if (occupancy >= room.capacity) throw new Error(`Room ${room.room_number} is full`)
  }

  const now = nowUTCISO()
  let fileBlobId = existing.local_photo_blob_id
  let fileBlobRecord: FileBlobRecord | null = null

  if (data.photoBlob && data.photoMimeType) {
    fileBlobId = generateId()
    fileBlobRecord = {
      id: fileBlobId,
      entity_type: "students",
      entity_id: id,
      field_name: "local_photo_blob_id",
      blob: data.photoBlob,
      mime_type: data.photoMimeType,
      size_bytes: data.photoBlob.size,
      status: "local_only",
      created_at: now,
      updated_at: now,
    }
  }

  const updatedStudent: Student = {
    ...existing,
    room_id: data.roomId || null,
    first_name: data.firstName.trim(),
    last_name: data.lastName.trim(),
    phone: data.phone.trim(),
    emergency_contact: data.emergencyContact.trim(),
    address: data.address?.trim() || null,
    blood_group: data.bloodGroup || null,
    local_photo_blob_id: fileBlobId,
    updated_at: now,
  }

  return await db.transaction("rw", [db.students, db.file_blobs, db.outbox, db.app_settings], async () => {
    const parentDependencyId = await getLatestActiveOutboxItem(id)

    await db.students.put(updatedStudent)

    if (fileBlobRecord) {
      await db.file_blobs.put(fileBlobRecord)
    }

    const sequence = await getNextOutboxSequence()
    const studentOutboxId = generateId()

    await db.outbox.add({
      id: studentOutboxId,
      sequence,
      entity_type: "students",
      entity_id: id,
      operation: "update",
      payload: { 
        ...updatedStudent,
        local_photo_blob_id: undefined 
      },
      status: "pending",
      depends_on: parentDependencyId,
      attempts: 0,
      created_at: now,
      updated_at: now,
    })

    if (fileBlobRecord) {
      const uploadSeq = await getNextOutboxSequence()
      await db.outbox.add({
        id: generateId(),
        sequence: uploadSeq,
        entity_type: "students",
        entity_id: id,
        operation: "file_upload",
        payload: { local_file_blob_id: fileBlobRecord.id },
        status: "pending",
        depends_on: studentOutboxId,
        attempts: 0,
        created_at: now,
        updated_at: now,
      })
    }

    return updatedStudent
  })
}

export async function archiveStudent(id: string, ownerId: string): Promise<Student> {
  const existing = await db.students.get(id)
  if (!existing || existing.deleted || existing.owner_id !== ownerId) throw new Error("Student not found")

  const now = nowUTCISO()
  const updatedStudent: Student = {
    ...existing,
    status: "archived",
    room_id: null,
    updated_at: now,
  }

  return await db.transaction("rw", [db.students, db.outbox, db.app_settings], async () => {
    const parentDependencyId = await getLatestActiveOutboxItem(id)

    await db.students.put(updatedStudent)

    const sequence = await getNextOutboxSequence()
    await db.outbox.add({
      id: generateId(),
      sequence,
      entity_type: "students",
      entity_id: id,
      operation: "update",
      payload: { 
        ...updatedStudent,
        local_photo_blob_id: undefined 
      },
      status: "pending",
      depends_on: parentDependencyId,
      attempts: 0,
      created_at: now,
      updated_at: now,
    })

    return updatedStudent
  })
}

export async function restoreStudent(id: string, ownerId: string): Promise<Student> {
  const existing = await db.students.get(id)
  if (!existing || existing.deleted || existing.owner_id !== ownerId) throw new Error("Student not found")

  const now = nowUTCISO()
  const updatedStudent: Student = {
    ...existing,
    status: "active",
    updated_at: now,
  }

  return await db.transaction("rw", [db.students, db.outbox, db.app_settings], async () => {
    const parentDependencyId = await getLatestActiveOutboxItem(id)

    await db.students.put(updatedStudent)

    const sequence = await getNextOutboxSequence()
    await db.outbox.add({
      id: generateId(),
      sequence,
      entity_type: "students",
      entity_id: id,
      operation: "update",
      payload: { 
        ...updatedStudent,
        local_photo_blob_id: undefined 
      },
      status: "pending",
      depends_on: parentDependencyId,
      attempts: 0,
      created_at: now,
      updated_at: now,
    })

    return updatedStudent
  })
}

export async function deleteStudent(id: string, ownerId: string): Promise<void> {
  await db.transaction("rw", [db.students, db.outbox, db.app_settings], async () => {
    const existing = await db.students.get(id)
    if (!existing || existing.deleted || existing.owner_id !== ownerId) return

    const parentDependencyId = await getLatestActiveOutboxItem(id)

    const now = nowUTCISO()
    await db.students.update(id, { deleted: true, room_id: null, updated_at: now })
    
    const sequence = await getNextOutboxSequence()
    await db.outbox.add({
      id: generateId(),
      sequence,
      entity_type: "students",
      entity_id: id,
      operation: "delete",
      payload: { id },
      status: "pending",
      depends_on: parentDependencyId,
      attempts: 0,
      created_at: now,
      updated_at: now,
    })
  })
}
