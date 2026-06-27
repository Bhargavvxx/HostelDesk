import { FeeRecord } from "@/local/types"
import { computeStudentFeeStats } from "@/local/queries/fees"
import { getISTDateKey } from "@/local/helpers"

interface StudentBalanceSummaryProps {
  records: FeeRecord[]
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
}

export function StudentBalanceSummary({ records }: StudentBalanceSummaryProps) {
  const todayIST = getISTDateKey()
  const { totalDue, totalPaid, studentBalance, isOverdue } = computeStudentFeeStats(records, todayIST)

  const balanceLabel =
    studentBalance > 0
      ? `Balance due: ${formatINR(studentBalance)}`
      : studentBalance < 0
        ? `Credit: ${formatINR(studentBalance)}`
        : "Fully paid"

  const balanceColor =
    isOverdue
      ? "text-destructive"
      : studentBalance < 0
        ? "text-success"
        : studentBalance === 0
          ? "text-success"
          : "text-foreground"

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm tabular-nums">
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Total due</p>
          <p className="font-semibold">{formatINR(totalDue)}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Total paid</p>
          <p className="font-semibold text-success">{formatINR(totalPaid)}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className={`font-semibold ${balanceColor}`}>{balanceLabel}</p>
        </div>
      </div>

      {isOverdue && (
        <span className="inline-flex items-center rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive">
          Overdue
        </span>
      )}
    </div>
  )
}
