import { useState } from "react"
import { checkOut, CheckOutInput } from "@/local/queries/movement"
import { useAuthStore } from "@/hooks/useAuthStore"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface MovementFormModalProps {
  isOpen: boolean
  onClose: () => void
  studentId: string
  onSuccess?: (msg: string) => void
}

const MOVEMENT_TYPES = [
  { value: "out_pass", label: "Out Pass" },
  { value: "overnight", label: "Overnight" },
  { value: "home_visit", label: "Home Visit" },
]

export function MovementFormModal({ isOpen, onClose, studentId, onSuccess }: MovementFormModalProps) {
  const { ownerId } = useAuthStore()

  const [type, setType] = useState<"out_pass" | "overnight" | "home_visit">("out_pass")
  const [expectedReturnDate, setExpectedReturnDate] = useState("")
  const [expectedReturnTime, setExpectedReturnTime] = useState("")
  const [purpose, setPurpose] = useState("")
  const [destination, setDestination] = useState("")
  
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ownerId) return

    setError(null)
    setIsSubmitting(true)

    try {
      let expectedReturnAt: string | null = null
      
      if (expectedReturnDate) {
        // Construct ISO UTC string from local date and time inputs
        const timeStr = expectedReturnTime || "23:59" // Default to end of day if time missing
        const localDate = new Date(`${expectedReturnDate}T${timeStr}:00`)
        if (isNaN(localDate.getTime())) {
          throw new Error("Invalid expected return date/time.")
        }
        expectedReturnAt = localDate.toISOString()
      }

      const input: CheckOutInput = {
        studentId,
        type,
        expectedReturnAt,
        purpose: purpose || null,
        destination: destination || null,
      }

      await checkOut(input, ownerId)
      
      const isOffline = !navigator.onLine
      onSuccess?.(isOffline ? "Checked out — will sync when online" : "Checked out successfully ✓")
      
      // Reset form on success
      setType("out_pass")
      setExpectedReturnDate("")
      setExpectedReturnTime("")
      setPurpose("")
      setDestination("")
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to check out student")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Check Out Student</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="type">Movement Type *</Label>
            <select
              id="type"
              value={type}
              onChange={e => setType(e.target.value as any)}
              className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {MOVEMENT_TYPES.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expectedReturnDate">Expected Return Date</Label>
              <Input
                id="expectedReturnDate"
                type="date"
                value={expectedReturnDate}
                onChange={e => setExpectedReturnDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedReturnTime">Time</Label>
              <Input
                id="expectedReturnTime"
                type="time"
                value={expectedReturnTime}
                onChange={e => setExpectedReturnTime(e.target.value)}
                disabled={!expectedReturnDate}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination">Destination</Label>
            <Input
              id="destination"
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder="e.g. Home, Market"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose / Notes</Label>
            <Textarea
              id="purpose"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              maxLength={200}
              placeholder="e.g. Medical checkup"
              rows={2}
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <DialogFooter>
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
              {isSubmitting ? "Checking out…" : "Check Out"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
