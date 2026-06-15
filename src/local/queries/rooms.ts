import { db } from "@/local/db"
import { Room } from "@/local/types"
import { generateId, nowUTCISO } from "@/local/helpers"
import { getNextOutboxSequence } from "@/sync/sequence"

// --- Queries ---

export async function getAllRooms(): Promise<Room[]> {
  return db.rooms.where("deleted").equals(0).sortBy("room_number")
}

export async function getActiveRooms(): Promise<Room[]> {
  const rooms = await db.rooms.where("deleted").equals(0).sortBy("room_number")
  return rooms.filter(r => r.status === "active")
}

export async function getArchivedRooms(): Promise<Room[]> {
  const rooms = await db.rooms.where("deleted").equals(0).sortBy("room_number")
  return rooms.filter(r => r.status === "archived")
}

export async function getRoomById(id: string): Promise<Room | undefined> {
  return db.rooms.get(id)
}

export async function getRoomOccupancy(roomId: string): Promise<number> {
  return db.students
    .where("room_id")
    .equals(roomId)
    .filter(s => s.status === "active" && s.deleted === false)
    .count()
}

export async function getRoomOccupancyMap(): Promise<Record<string, number>> {
  const allActiveStudents = await db.students
    .where("deleted")
    .equals(0)
    .filter(s => s.status === "active" && s.room_id !== null)
    .toArray()

  const map: Record<string, number> = {}
  for (const s of allActiveStudents) {
    if (s.room_id) {
      map[s.room_id] = (map[s.room_id] || 0) + 1
    }
  }
  return map
}

export async function isRoomFull(roomId: string): Promise<boolean> {
  const room = await getRoomById(roomId)
  if (!room) return false
  const occupancy = await getRoomOccupancy(roomId)
  return occupancy >= room.capacity
}

export async function isRoomNumberTaken(roomNumber: string, excludeId?: string): Promise<boolean> {
  const numLower = roomNumber.trim().toLowerCase()
  const allRooms = await db.rooms.where("deleted").equals(0).toArray()
  return allRooms.some(
    r => r.id !== excludeId && r.room_number.toLowerCase() === numLower
  )
}

// --- Mutations ---

export interface CreateRoomInput {
  roomNumber: string
  capacity: number
  notes?: string | null
}

export interface UpdateRoomInput {
  roomNumber: string
  capacity: number
  notes?: string | null
}

export async function createRoom(data: CreateRoomInput, ownerId: string): Promise<Room> {
  if (!data.roomNumber.trim()) throw new Error("Room number is required")
  if (data.capacity < 1 || data.capacity > 50) throw new Error("Capacity must be between 1 and 50")
  if (data.notes && data.notes.length > 200) throw new Error("Notes must be 200 characters or less")
  
  const taken = await isRoomNumberTaken(data.roomNumber)
  if (taken) throw new Error("A room with this number already exists")

  const roomId = generateId()
  const now = nowUTCISO()

  const room: Room = {
    id: roomId,
    owner_id: ownerId,
    room_number: data.roomNumber.trim(),
    capacity: data.capacity,
    notes: data.notes?.trim() || null,
    status: "active",
    deleted: false,
    created_at: now,
    updated_at: now,
  }

  await db.transaction("rw", db.rooms, db.outbox, db.app_settings, async () => {
    await db.rooms.put(room)
    // Safe to call here: getNextOutboxSequence uses db.app_settings and db.outbox which are in this transaction
    const sequence = await getNextOutboxSequence()
    await db.outbox.add({
      id: generateId(),
      sequence,
      entity_type: "rooms",
      entity_id: roomId,
      operation: "insert",
      payload: { ...room },
      status: "pending",
      attempts: 0,
      created_at: now,
      updated_at: now,
    })
  })

  return room
}

export async function updateRoom(id: string, data: UpdateRoomInput, ownerId: string): Promise<Room> {
  if (!data.roomNumber.trim()) throw new Error("Room number is required")
  if (data.capacity < 1 || data.capacity > 50) throw new Error("Capacity must be between 1 and 50")
  if (data.notes && data.notes.length > 200) throw new Error("Notes must be 200 characters or less")

  const taken = await isRoomNumberTaken(data.roomNumber, id)
  if (taken) throw new Error("A room with this number already exists")

  const occupancy = await getRoomOccupancy(id)
  if (data.capacity < occupancy) {
    throw new Error(`Cannot reduce below current occupancy (${occupancy} students)`)
  }

  return await db.transaction("rw", db.rooms, db.outbox, db.app_settings, async () => {
    const existing = await db.rooms.get(id)
    if (!existing || existing.deleted || existing.owner_id !== ownerId) throw new Error("Room not found")

    const now = nowUTCISO()
    const updatedRoom: Room = {
      ...existing,
      room_number: data.roomNumber.trim(),
      capacity: data.capacity,
      notes: data.notes?.trim() || null,
      updated_at: now,
    }

    await db.rooms.put(updatedRoom)
    const sequence = await getNextOutboxSequence()
    await db.outbox.add({
      id: generateId(),
      sequence,
      entity_type: "rooms",
      entity_id: id,
      operation: "update",
      payload: { ...updatedRoom },
      status: "pending",
      attempts: 0,
      created_at: now,
      updated_at: now,
    })

    return updatedRoom
  })
}

export async function archiveRoom(id: string, ownerId: string): Promise<Room> {
  const occupancy = await getRoomOccupancy(id)
  if (occupancy > 0) {
    throw new Error("Move all students out of this room before archiving.")
  }

  return await db.transaction("rw", db.rooms, db.outbox, db.app_settings, async () => {
    const existing = await db.rooms.get(id)
    if (!existing || existing.deleted || existing.owner_id !== ownerId) throw new Error("Room not found")

    const now = nowUTCISO()
    const updatedRoom: Room = {
      ...existing,
      status: "archived",
      updated_at: now,
    }

    await db.rooms.put(updatedRoom)
    const sequence = await getNextOutboxSequence()
    await db.outbox.add({
      id: generateId(),
      sequence,
      entity_type: "rooms",
      entity_id: id,
      operation: "update",
      payload: { ...updatedRoom },
      status: "pending",
      attempts: 0,
      created_at: now,
      updated_at: now,
    })

    return updatedRoom
  })
}

export async function restoreRoom(id: string, ownerId: string): Promise<Room> {
  return await db.transaction("rw", db.rooms, db.outbox, db.app_settings, async () => {
    const existing = await db.rooms.get(id)
    if (!existing || existing.deleted || existing.owner_id !== ownerId) throw new Error("Room not found")

    const now = nowUTCISO()
    const updatedRoom: Room = {
      ...existing,
      status: "active",
      updated_at: now,
    }

    await db.rooms.put(updatedRoom)
    const sequence = await getNextOutboxSequence()
    await db.outbox.add({
      id: generateId(),
      sequence,
      entity_type: "rooms",
      entity_id: id,
      operation: "update",
      payload: { ...updatedRoom },
      status: "pending",
      attempts: 0,
      created_at: now,
      updated_at: now,
    })

    return updatedRoom
  })
}

export async function deleteRoom(id: string, ownerId: string): Promise<void> {
  const occupancy = await getRoomOccupancy(id)
  if (occupancy > 0) {
    throw new Error("Remove all students from this room before deleting.")
  }

  await db.transaction("rw", db.rooms, db.outbox, db.app_settings, async () => {
    const existing = await db.rooms.get(id)
    if (!existing || existing.deleted || existing.owner_id !== ownerId) return

    const now = nowUTCISO()
    await db.rooms.update(id, { deleted: true, updated_at: now })
    
    const sequence = await getNextOutboxSequence()
    await db.outbox.add({
      id: generateId(),
      sequence,
      entity_type: "rooms",
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
