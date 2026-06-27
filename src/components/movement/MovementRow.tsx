import { MovementLog } from "@/local/types"
import { computeMovementStatus } from "@/local/queries/movement"
import { nowUTCISO } from "@/local/helpers"

interface MovementRowProps {
  log: MovementLog
  onCheckIn: (logId: string) => void
  isCheckingIn?: boolean
}

function formatDateTime(isoString: string | null): string {
  if (!isoString) return "—"
  const date = new Date(isoString)
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date)
}

const TYPE_LABELS: Record<MovementLog["type"], string> = {
  out_pass: "Out Pass",
  overnight: "Overnight",
  home_visit: "Home Visit",
}

export function MovementRow({ log, onCheckIn, isCheckingIn }: MovementRowProps) {
  const currentStatus = computeMovementStatus(log, nowUTCISO())

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-shadow hover:shadow-sm sm:flex-row sm:items-center sm:gap-4">
      {/* Left: Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{TYPE_LABELS[log.type]}</span>
          {log.is_open ? (
            currentStatus === "overdue" ? (
              <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
                Overdue
              </span>
            ) : (
              <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning-foreground">
                Out
              </span>
            )
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Closed
            </span>
          )}
        </div>

        {(log.destination || log.purpose) && (
          <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
            {log.destination && <span>To: {log.destination}</span>}
            {log.destination && log.purpose && <span className="mx-1">•</span>}
            {log.purpose && <span>{log.purpose}</span>}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
          <div>
            <span className="opacity-75">Out:</span> {formatDateTime(log.check_out_time)}
          </div>
          {log.expected_return_at && log.is_open && (
            <div>
              <span className="opacity-75">Expected:</span>{" "}
              <span className={currentStatus === "overdue" ? "text-destructive font-medium" : ""}>
                {formatDateTime(log.expected_return_at)}
              </span>
            </div>
          )}
          {!log.is_open && log.check_in_time && (
            <div>
              <span className="opacity-75">In:</span> {formatDateTime(log.check_in_time)}
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex shrink-0 items-center justify-end">
        {log.is_open && (
          <button
            onClick={() => onCheckIn(log.id)}
            disabled={isCheckingIn}
            className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/80 disabled:opacity-50"
          >
            {isCheckingIn ? "Checking in…" : "Check In"}
          </button>
        )}
      </div>
    </div>
  )
}
