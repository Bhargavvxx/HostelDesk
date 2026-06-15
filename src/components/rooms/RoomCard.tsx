import { Room } from "@/local/types"
import { Edit2, Archive, ArchiveRestore, Trash2 } from "lucide-react"

interface RoomCardProps {
  room: Room
  occupancy: number
  onEdit: (room: Room) => void
  onArchive: (room: Room) => void
  onRestore: (room: Room) => void
  onDelete: (room: Room) => void
}

export function RoomCard({ room, occupancy, onEdit, onArchive, onRestore, onDelete }: RoomCardProps) {
  const isFull = occupancy >= room.capacity
  const isEmpty = occupancy === 0

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{room.room_number}</h3>
          {room.notes && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
              {room.notes}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {room.status === "active" ? (
            <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
              Active
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              Archived
            </span>
          )}
          
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Occupancy:
            </span>
            <span 
              className={`text-sm font-bold ${
                isFull ? "text-destructive" : occupancy > 0 ? "text-warning" : "text-muted-foreground"
              }`}
            >
              {occupancy} / {room.capacity}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-end gap-2 pt-2 border-t border-border/50">
        <button
          onClick={() => onEdit(room)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Edit2 className="size-3.5" />
          Edit
        </button>

        {room.status === "active" ? (
          <button
            onClick={() => onArchive(room)}
            disabled={!isEmpty}
            title={!isEmpty ? "Move all students out before archiving" : undefined}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Archive className="size-3.5" />
            Archive
          </button>
        ) : (
          <button
            onClick={() => onRestore(room)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArchiveRestore className="size-3.5" />
            Restore
          </button>
        )}

        {isEmpty && (
          <button
            onClick={() => onDelete(room)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors ml-auto"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
