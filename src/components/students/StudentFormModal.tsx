import { useState, useEffect } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/local/db"
import { Student } from "@/local/types"
import { createStudent, updateStudent } from "@/local/queries/students"
import { useAuthStore } from "@/hooks/useAuthStore"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ImagePreview } from "@/components/common/ImagePreview"

interface StudentFormModalProps {
  isOpen: boolean
  onClose: () => void
  student?: Student // If provided, we're in edit mode
  onSuccess?: (msg: string) => void
}

export function StudentFormModal({ isOpen, onClose, student, onSuccess }: StudentFormModalProps) {
  const { ownerId } = useAuthStore()
  
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [emergencyContact, setEmergencyContact] = useState("")
  const [address, setAddress] = useState("")
  const [bloodGroup, setBloodGroup] = useState("")
  const [roomId, setRoomId] = useState("")
  
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch active rooms for dropdown
  const activeRooms = useLiveQuery(
    () => db.rooms.where("deleted").equals(0).filter(r => r.status === "active").sortBy("room_number"),
    []
  )

  useEffect(() => {
    if (isOpen) {
      setFirstName(student?.first_name || "")
      setLastName(student?.last_name || "")
      setPhone(student?.phone || "")
      setEmergencyContact(student?.emergency_contact || "")
      setAddress(student?.address || "")
      setBloodGroup(student?.blood_group || "")
      setRoomId(student?.room_id || "")
      
      setPhotoFile(null)
      setPhotoPreview(null)
      setError(null)
    }
  }, [isOpen, student])

  useEffect(() => {
    if (photoFile) {
      const url = URL.createObjectURL(photoFile)
      setPhotoPreview(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [photoFile])

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be less than 5MB")
      return
    }
    if (!file.type.startsWith("image/")) {
      setError("Photo must be an image")
      return
    }
    setPhotoFile(file)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ownerId) return

    setError(null)
    setIsSubmitting(true)

    try {
      const payload = {
        firstName,
        lastName,
        phone,
        emergencyContact,
        address: address || null,
        bloodGroup: bloodGroup || null,
        roomId: roomId || null,
        photoBlob: photoFile || null,
        photoMimeType: photoFile?.type || null
      }

      if (student) {
        await updateStudent(student.id, payload, ownerId)
        onSuccess?.("Student updated successfully")
      } else {
        await createStudent(payload, ownerId)
        const isOffline = !navigator.onLine
        onSuccess?.(isOffline ? "Student saved — will sync when online" : "Student created \u2713")
      }
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to save student")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{student ? "Edit Student" : "Add Student"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          
          {/* Photo Upload */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="size-24 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="size-full object-cover" />
              ) : student ? (
                <ImagePreview 
                  localBlobId={student.local_photo_blob_id}
                  cloudPath={student.photo_path}
                  className="size-full"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-muted text-muted-foreground text-xs">
                  Photo
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="photo">Profile Photo</Label>
              <Input 
                id="photo" 
                type="file" 
                accept="image/jpeg, image/png, image/webp"
                onChange={handlePhotoChange}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">Max 5MB. JPEG, PNG, WEBP.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={50}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={50}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={20}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Emergency Contact</Label>
              <Input
                id="emergencyContact"
                type="tel"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                maxLength={20}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bloodGroup">Blood Group</Label>
              <Input
                id="bloodGroup"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                maxLength={5}
                placeholder="e.g. O+"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="room">Assign Room</Label>
              <select
                id="room"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Unassigned</option>
                {activeRooms?.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.room_number} (Capacity: {r.capacity})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={200}
            />
          </div>

          {error && (
            <div className="text-sm text-destructive font-medium">
              {error}
            </div>
          )}

          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
