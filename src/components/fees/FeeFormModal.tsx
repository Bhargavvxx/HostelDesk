import { useState, useEffect } from "react"
import { FeeRecord } from "@/local/types"
import { createFee, updateFee, CreateFeeInput, UpdateFeeInput } from "@/local/queries/fees"
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

interface FeeFormModalProps {
  isOpen: boolean
  onClose: () => void
  studentId: string
  record?: FeeRecord   // If provided: edit mode
  onSuccess?: (msg: string) => void
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank Transfer" },
  { value: "other", label: "Other" },
]

export function FeeFormModal({ isOpen, onClose, studentId, record, onSuccess }: FeeFormModalProps) {
  const { ownerId } = useAuthStore()

  const [amountDue, setAmountDue] = useState("")
  const [amountPaid, setAmountPaid] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [paymentDate, setPaymentDate] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "bank" | "other" | "">("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setAmountDue(record ? String(record.amount_due) : "")
      setAmountPaid(record ? String(record.amount_paid) : "")
      setDueDate(record?.due_date || "")
      setPaymentDate(record?.payment_date || "")
      setPaymentMethod((record?.payment_method as any) || "")
      setNotes(record?.notes || "")
      setError(null)
    }
  }, [isOpen, record])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ownerId) return

    setError(null)
    setIsSubmitting(true)

    try {
      const due = parseFloat(amountDue) || 0
      const paid = parseFloat(amountPaid) || 0
      const method = paymentMethod || null
      const resolvedDueDate = dueDate || null
      const resolvedPaymentDate = paymentDate || null

      if (record) {
        const input: UpdateFeeInput = {
          amountDue: due,
          amountPaid: paid,
          dueDate: resolvedDueDate,
          paymentDate: resolvedPaymentDate,
          paymentMethod: method as any,
          notes: notes || null,
        }
        await updateFee(record.id, input, ownerId)
        onSuccess?.("Fee updated")
      } else {
        const input: CreateFeeInput = {
          studentId,
          amountDue: due,
          amountPaid: paid,
          dueDate: resolvedDueDate,
          paymentDate: resolvedPaymentDate,
          paymentMethod: method as any,
          notes: notes || null,
        }
        await createFee(input, ownerId)
        const isOffline = !navigator.onLine
        onSuccess?.(isOffline ? "Fee saved — will sync when online" : "Fee recorded ✓")
      }
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to save fee record")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{record ? "Edit Fee Record" : "Add Fee Record"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amountDue">Amount Due (₹)</Label>
              <Input
                id="amountDue"
                type="number"
                min="0"
                step="0.01"
                value={amountDue}
                onChange={e => setAmountDue(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amountPaid">Amount Paid (₹)</Label>
              <Input
                id="amountPaid"
                type="number"
                min="0"
                step="0.01"
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">
                Due Date
                {(parseFloat(amountDue) || 0) > 0 && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDate">
                Payment Date
                {(parseFloat(amountPaid) || 0) > 0 && (
                  <span className="text-xs text-muted-foreground ml-1">(defaults to today)</span>
                )}
              </Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentMethod">
              Payment Method
              {(parseFloat(amountPaid) || 0) > 0 && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <select
              id="paymentMethod"
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as any)}
              className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">None</option>
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={200}
              placeholder="e.g. Monthly rent — July"
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
              {isSubmitting ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
