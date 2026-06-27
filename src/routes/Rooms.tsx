import { useState, useMemo } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { BedDouble, Plus } from "lucide-react"
import { db } from "@/local/db"
import { Room } from "@/local/types"
import { getRoomOccupancyMap, archiveRoom, restoreRoom, deleteRoom } from "@/local/queries/rooms"
import { useAuthStore } from "@/hooks/useAuthStore"
import { RoomCard } from "@/components/rooms/RoomCard"
import { Banner } from "@/components/common/Banner"
import { EmptyState } from "@/components/common/EmptyState"
import { RoomFormModal } from "@/components/rooms/RoomFormModal"

type FilterType = "active" | "archived" | "all"

export default function Rooms() {
  const { ownerId } = useAuthStore()

  const [filter, setFilter] = useState<FilterType>("active")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | undefined>(undefined)
  
  const [banner, setBanner] = useState<{ type: "success" | "error"; msg: string } | null>(null)

  // Auto-dismiss banner after 3s
  const showBanner = (type: "success" | "error", msg: string) => {
    setBanner({ type, msg })
    setTimeout(() => setBanner(null), 3000)
  }

  // Reactive queries
  const allRooms = useLiveQuery(() => db.rooms.where("deleted").equals(0).sortBy("room_number"), [])
  const occupancyMap = useLiveQuery(() => getRoomOccupancyMap(), [], {}) as Record<string, number>

  const filteredRooms = useMemo(() => {
    if (!allRooms) return []
    if (filter === "all") return allRooms
    return allRooms.filter(r => r.status === filter)
  }, [allRooms, filter])

  const handleEdit = (room: Room) => {
    setEditingRoom(room)
    setIsModalOpen(true)
  }

  const handleAddNew = () => {
    setEditingRoom(undefined)
    setIsModalOpen(true)
  }

  const handleArchive = async (room: Room) => {
    if (!ownerId) return
    if (window.confirm(`Archive room ${room.room_number}?`)) {
      try {
        await archiveRoom(room.id, ownerId)
        showBanner("success", `Room ${room.room_number} archived`)
      } catch (err: any) {
        showBanner("error", err.message || "Failed to archive room")
      }
    }
  }

  const handleRestore = async (room: Room) => {
    if (!ownerId) return
    if (window.confirm(`Restore room ${room.room_number}?`)) {
      try {
        await restoreRoom(room.id, ownerId)
        showBanner("success", `Room ${room.room_number} restored`)
      } catch (err: any) {
        showBanner("error", err.message || "Failed to restore room")
      }
    }
  }

  const handleDelete = async (room: Room) => {
    if (!ownerId) return
    if (window.confirm(`Permanently delete room ${room.room_number}?`)) {
      try {
        await deleteRoom(room.id, ownerId)
        showBanner("success", `Room ${room.room_number} deleted`)
      } catch (err: any) {
        showBanner("error", err.message || "Failed to delete room")
      }
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Rooms</h1>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Add Room</span>
        </button>
      </div>

      {/* Local Banner */}
      {banner && <Banner type={banner.type} message={banner.msg} />}

      {/* Filter Tabs */}
      <div className="flex w-full items-center gap-1 rounded-lg bg-muted p-1 sm:w-fit">
        {(["active", "archived", "all"] as FilterType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-all sm:flex-none ${
              filter === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Room Grid */}
      {filteredRooms.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              occupancy={occupancyMap[room.id] || 0}
              onEdit={handleEdit}
              onArchive={handleArchive}
              onRestore={handleRestore}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <EmptyState
          icon={BedDouble}
          title="No rooms found"
          description={filter === "active" 
            ? "You haven't created any rooms yet. Add one to get started."
            : `There are no ${filter} rooms.`}
          action={filter === "active" ? {
            label: "Add your first room",
            onClick: handleAddNew
          } : {
            label: "View active rooms",
            onClick: () => setFilter("active")
          }}
        />
      )}

      {/* Modal */}
      <RoomFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        room={editingRoom}
        onSuccess={(msg) => showBanner("success", msg)}
      />
    </div>
  )
}
