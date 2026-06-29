import { useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { 
  AlertTriangle, 
  AlertCircle, 
  RefreshCw, 
  Trash2, 
  Clock, 
  CheckCircle2,
  ChevronLeft
} from "lucide-react"
import { Link } from "react-router"
import { Banner } from "@/components/common/Banner"
import { useSyncStatus } from "@/sync/status"
import {
  getConflictItems,
  getHighAttemptFailedItems,
  getOverwriteLog,
  removeOutboxItem,
  retryOutboxItem,
  resolveMovementDuplicate,
  getDependentDescendants,
  OverwriteLogEntry,
} from "@/local/queries/sync"
import { OutboxRecord } from "@/local/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string) {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function isMovementDuplicateConflict(item: OutboxRecord): boolean {
  return (
    item.entity_type === "movement_logs" &&
    item.operation === "insert" &&
    item.status === "conflict"
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ConflictItemRowProps {
  item: OutboxRecord
  onAction: () => void
}

function ConflictItemRow({ item, onAction }: ConflictItemRowProps) {
  const [isWorking, setIsWorking] = useState(false)
  const [banner, setBanner] = useState<{ type: "success" | "error"; msg: string } | null>(null)

  const isMovement = isMovementDuplicateConflict(item)

  const handleDiscard = async () => {
    if (isMovement) {
      const descendants = await getDependentDescendants(item.id)
      const depMsg = descendants.length > 0 
        ? ` and ${descendants.length} dependent sync item(s)` 
        : ""

      const ok = window.confirm(
        `This will discard your local check-out${depMsg}. The cloud already accepted a check-out for this student. Confirm?`
      )
      if (!ok) return
      setIsWorking(true)
      try {
        await resolveMovementDuplicate(item.id, item.entity_id)
        setBanner({ type: "success", msg: "Local check-out discarded." })
        onAction()
      } catch (err: any) {
        setBanner({ type: "error", msg: err.message || "Failed to resolve conflict." })
      } finally {
        setIsWorking(false)
      }
    } else {
      const descendants = await getDependentDescendants(item.id)
      const depMsg = descendants.length > 0 
        ? ` and ${descendants.length} dependent sync item(s)` 
        : ""
        
      const ok = window.confirm(
        `This will permanently stop retrying this local change${depMsg}. This cannot be undone.`
      )
      if (!ok) return
      setIsWorking(true)
      try {
        await removeOutboxItem(item.id)
        setBanner({ type: "success", msg: "Sync item removed." })
        onAction()
      } catch (err: any) {
        setBanner({ type: "error", msg: err.message || "Failed to remove item." })
      } finally {
        setIsWorking(false)
      }
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {banner && (
          <div className="mb-3">
            <Banner type={banner.type} message={banner.msg} />
          </div>
        )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
              <AlertTriangle className="size-3" />
              Conflict
            </span>
            <span className="text-xs text-muted-foreground capitalize">
              {item.entity_type.replace("_", " ")} · {item.operation}
            </span>
          </div>
          {isMovement && (
            <p className="mt-2 text-sm text-muted-foreground">
              Two check-outs were recorded for this student while offline. The cloud already accepted one. Your local check-out was never synced.
            </p>
          )}
          {item.last_error && (
            <p className="mt-1.5 text-xs text-muted-foreground font-mono line-clamp-2">
              {item.last_error}
            </p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {formatRelativeTime(item.created_at)}
          </p>
        </div>
        <button
          onClick={handleDiscard}
          disabled={isWorking}
          className="shrink-0 flex items-center gap-1.5 rounded-lg border border-destructive bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
        >
          <Trash2 className="size-3.5" />
          {isMovement ? "Discard local check-out" : "Remove failed sync item"}
        </button>
      </div>
    </div>
  )
}

interface FailedItemRowProps {
  item: OutboxRecord
  onAction: () => void
}

function FailedItemRow({ item, onAction }: FailedItemRowProps) {
  const [isWorking, setIsWorking] = useState(false)
  const [banner, setBanner] = useState<{ type: "success" | "error"; msg: string } | null>(null)

  const handleRetry = async () => {
    setIsWorking(true)
    try {
      await retryOutboxItem(item.id)
      setBanner({ type: "success", msg: "Item re-queued for retry." })
      onAction()
    } catch (err: any) {
      setBanner({ type: "error", msg: err.message || "Failed to retry." })
    } finally {
      setIsWorking(false)
    }
  }

  const handleRemove = async () => {
    const descendants = await getDependentDescendants(item.id)
    const depMsg = descendants.length > 0 
      ? ` and ${descendants.length} dependent sync item(s)` 
      : ""
      
    const ok = window.confirm(
      `This will permanently stop retrying this local change${depMsg}. This cannot be undone.`
    )
    if (!ok) return
    setIsWorking(true)
    try {
      await removeOutboxItem(item.id)
      setBanner({ type: "success", msg: "Sync item removed." })
      onAction()
    } catch (err: any) {
      setBanner({ type: "error", msg: err.message || "Failed to remove item." })
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {banner && (
          <div className="mb-3">
            <Banner type={banner.type} message={banner.msg} />
          </div>
        )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <AlertCircle className="size-3" />
              Needs Attention
            </span>
            <span className="text-xs text-muted-foreground capitalize">
              {item.entity_type.replace("_", " ")} · {item.operation}
            </span>
            <span className="text-xs text-muted-foreground">
              {item.attempts} attempts
            </span>
          </div>
          {item.last_error && (
            <p className="mt-1.5 text-xs text-muted-foreground font-mono line-clamp-2">
              {item.last_error}
            </p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {formatRelativeTime(item.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRetry}
            disabled={isWorking}
            className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className="size-3.5" />
            Retry
          </button>
          <button
            onClick={handleRemove}
            disabled={isWorking}
            className="flex items-center gap-1.5 rounded-lg border border-destructive bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function Sync() {
  const { lastSyncAt, lastError } = useSyncStatus()

  // Live queries — re-render whenever outbox or app_settings change
  const conflictItems = useLiveQuery(() => getConflictItems(), []) ?? []
  const highAttemptItems = useLiveQuery(() => getHighAttemptFailedItems(), []) ?? []
  const overwriteLog = useLiveQuery(() => getOverwriteLog(), []) ?? []

  // Force re-render of lists after an action (live queries handle it automatically)
  const onAction = () => { /* useLiveQuery re-renders automatically */ }

  const hasIssues = conflictItems.length > 0 || highAttemptItems.length > 0

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-6 lg:p-8">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sync Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and resolve sync conflicts and failed items.
          </p>
        </div>
      </div>

      {/* ── Last sync info ── */}
      <div className="flex flex-wrap gap-4 rounded-lg bg-muted/50 border border-border px-4 py-3 text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-4" />
          Last sync:{" "}
          <span className="text-foreground font-medium">
            {lastSyncAt ? formatRelativeTime(lastSyncAt) : "Never"}
          </span>
        </span>
        {lastError && (
          <span className="flex items-center gap-1.5 text-destructive text-xs">
            <AlertCircle className="size-3.5" />
            {lastError}
          </span>
        )}
      </div>

      {/* ── All-clear state ── */}
      {!hasIssues && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card py-14 text-center">
          <CheckCircle2 className="size-10 text-emerald-500" />
          <p className="font-semibold">Everything looks good</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            No conflicts or failed items need your attention.
          </p>
        </div>
      )}

      {/* ── Conflicts ── */}
      {conflictItems.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            Conflicts ({conflictItems.length})
          </h2>
          <div className="flex flex-col gap-3">
            {conflictItems.map(item => (
              <ConflictItemRow key={item.id} item={item} onAction={onAction} />
            ))}
          </div>
        </section>
      )}

      {/* ── Needs Attention (high-attempt failed) ── */}
      {highAttemptItems.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <AlertCircle className="size-4 text-amber-500" />
            Needs Attention ({highAttemptItems.length})
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            These items have failed too many times to retry automatically. You can retry manually or remove them.
          </p>
          <div className="flex flex-col gap-3">
            {highAttemptItems.map(item => (
              <FailedItemRow key={item.id} item={item} onAction={onAction} />
            ))}
          </div>
        </section>
      )}

      {/* ── Recently Overwritten ── */}
      {overwriteLog.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            Recently Overwritten ({overwriteLog.length})
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            These records were updated by a newer cloud version during sync (last-write-wins).
          </p>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs">Table</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs">Record ID</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs">When</th>
                </tr>
              </thead>
              <tbody>
                {overwriteLog.map((entry: OverwriteLogEntry, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 capitalize text-xs">{entry.table.replace("_", " ")}</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground truncate max-w-[140px]">
                      {entry.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {formatRelativeTime(entry.overwritten_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
