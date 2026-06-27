import { Student } from "@/local/types"
import { Edit2, Archive, ArchiveRestore, Trash2, FileText, Info } from "lucide-react"
import { ImagePreview } from "@/components/common/ImagePreview"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/local/db"

interface StudentCardProps {
  student: Student
  onEdit: (student: Student) => void
  onArchive: (student: Student) => void
  onRestore: (student: Student) => void
  onDelete: (student: Student) => void
  onViewInfo: (student: Student) => void
  onViewDocs: (student: Student) => void
  isOverdue?: boolean
  movementStatus?: "in" | "out" | "overdue"
}

export function StudentCard({ student, onEdit, onArchive, onRestore, onDelete, onViewInfo, onViewDocs, isOverdue, movementStatus }: StudentCardProps) {
  const room = useLiveQuery(
    () => (student.room_id ? db.rooms.get(student.room_id) : undefined),
    [student.room_id]
  )

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="size-14 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
          <ImagePreview 
            localBlobId={student.local_photo_blob_id} 
            cloudPath={student.photo_path} 
            className="size-full"
          />
        </div>
        
        <div className="flex-1 overflow-hidden">
          <h3 className="truncate text-base font-semibold tracking-tight">
            {student.first_name} {student.last_name}
          </h3>
          <p className="truncate text-sm text-muted-foreground">{student.phone}</p>
          
          <div className="mt-1 flex items-center gap-2">
            {student.status === "active" ? (
              <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                Active
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                Archived
              </span>
            )}

            {room && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Room {room.room_number}
              </span>
            )}

            {isOverdue && (
              <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                Overdue
              </span>
            )}

            {movementStatus === "out" && (
              <span className="inline-flex items-center rounded-full bg-warning/20 px-2 py-0.5 text-xs font-semibold text-warning-foreground">
                Out
              </span>
            )}
            
            {movementStatus === "overdue" && (
              <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                Overdue (Out)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-1 pt-2 border-t border-border/50">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onViewInfo(student)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="View Details"
          >
            <Info className="size-4" />
          </button>
          <button
            onClick={() => onViewDocs(student)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Documents"
          >
            <FileText className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(student)}
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Edit2 className="size-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </button>

          {student.status === "active" ? (
            <button
              onClick={() => onArchive(student)}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Archive className="size-3.5" />
              <span className="hidden sm:inline">Archive</span>
            </button>
          ) : (
            <button
              onClick={() => onRestore(student)}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ArchiveRestore className="size-3.5" />
              <span className="hidden sm:inline">Restore</span>
            </button>
          )}

          {student.status === "archived" && (
            <button
              onClick={() => onDelete(student)}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors ml-auto"
              title="Delete permanently"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
