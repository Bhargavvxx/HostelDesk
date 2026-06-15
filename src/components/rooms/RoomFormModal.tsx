import { useState, useEffect } from "react"
import { Room } from "@/local/types"
import { createRoom, updateRoom } from "@/local/queries/rooms"
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

interface RoomFormModalProps {
  isOpen: boolean
  onClose: () => void
  room?: Room // If provided, we're in edit mode
  onSuccess?: (msg: string) => void
}

export function RoomFormModal({ isOpen, onClose, room, onSuccess }: RoomFormModalProps) {
  const { ownerId } = useAuthStore()
  
  const [roomNumber, setRoomNumber] = useState("")
  const [capacity, setCapacity] = useState("")
  const [notes, setNotes] = useState("")
  
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens/closes or room changes
  useEffect(() => {
    if (isOpen) {
      setRoomNumber(room?.room_number || "")
      setCapacity(room?.capacity?.toString() || "")
      setNotes(room?.notes || "")
      setError(null)
    }
  }, [isOpen, room])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ownerId) return

    setError(null)
    setIsSubmitting(true)

    try {
      const parsedCapacity = parseInt(capacity, 10)
      if (isNaN(parsedCapacity)) {
        throw new Error("Capacity must be a valid number")
      }

      if (room) {
        await updateRoom(room.id, {
          roomNumber,
          capacity: parsedCapacity,
          notes: notes || null
        }, ownerId)
        onSuccess?.("Room updated successfully")
      } else {
        await createRoom({
          roomNumber,
          capacity: parsedCapacity,
          notes: notes || null
        }, ownerId)
        const isOffline = !navigator.onLine
        onSuccess?.(isOffline ? "Room saved — will sync when online" : "Room created \u2713")
      }
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to save room")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{room ? "Edit Room" : "Add Room"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="roomNumber">Room Number</Label>
            <Input
              id="roomNumber"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="e.g. 101"
              maxLength={20}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              max="50"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="e.g. 2"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details..."
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
