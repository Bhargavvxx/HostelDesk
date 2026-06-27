import { Student } from "@/local/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ImagePreview } from "@/components/common/ImagePreview"

interface StudentDetailModalProps {
  isOpen: boolean
  onClose: () => void
  student?: Student
}

export function StudentDetailModal({ isOpen, onClose, student }: StudentDetailModalProps) {
  if (!student) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Student Details</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-6 py-4">
          <div className="flex items-center gap-4">
            <div className="size-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
              <ImagePreview 
                localBlobId={student.local_photo_blob_id}
                cloudPath={student.photo_path}
                className="size-full"
              />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {student.first_name} {student.last_name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                {student.status === "active" ? (
                  <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                    Archived
                  </span>
                )}
                {student.room_id ? (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Assigned
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                    Unassigned
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground">Phone</p>
              <p className="font-medium">{student.phone}</p>
            </div>
            
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground">Emergency Contact</p>
              <p className="font-medium">{student.emergency_contact}</p>
            </div>

            <div className="space-y-1">
              <p className="font-medium text-muted-foreground">Blood Group</p>
              <p className="font-medium">{student.blood_group || "-"}</p>
            </div>
            
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground">Added On</p>
              <p className="font-medium">{new Date(student.created_at).toLocaleDateString()}</p>
            </div>

            <div className="col-span-2 space-y-1">
              <p className="font-medium text-muted-foreground">Address</p>
              <p className="font-medium whitespace-pre-wrap">{student.address || "-"}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
