import { FeeRecord } from "@/local/types"
import { Edit2, Trash2 } from "lucide-react"

interface FeeRowProps {
  record: FeeRecord
  onEdit: (record: FeeRecord) => void
  onDelete: (record: FeeRecord) => void
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  const [y, m, d] = dateStr.split("-")
  return `${d}/${m}/${y}`
}

const STATUS_STYLES: Record<FeeRecord["status"], string> = {
  paid: "bg-success/15 text-success",
  partial: "bg-warning/15 text-warning",
  pending: "bg-muted text-muted-foreground",
}

export function FeeRow({ record, onEdit, onDelete }: FeeRowProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3 transition-shadow hover:shadow-sm sm:flex-row sm:items-center sm:gap-4">
      {/* Left: notes / dates */}
      <div className="flex-1 min-w-0">
        {record.notes && (
          <p className="truncate text-sm font-medium">{record.notes}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
          {record.due_date && (
            <span>Due {formatDate(record.due_date)}</span>
          )}
          {record.payment_date && (
            <span>Paid {formatDate(record.payment_date)}</span>
          )}
          {record.payment_method && (
            <span className="capitalize">{record.payment_method}</span>
          )}
        </div>
      </div>

      {/* Right: amounts + status + actions */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right tabular-nums">
          <p className="text-sm font-semibold">{formatINR(record.amount_due)}</p>
          {record.amount_paid > 0 && (
            <p className="text-xs text-success">Paid {formatINR(record.amount_paid)}</p>
          )}
        </div>

        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[record.status]}`}>
          {record.status}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(record)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Edit"
          >
            <Edit2 className="size-3.5" />
          </button>
          <button
            onClick={() => onDelete(record)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
