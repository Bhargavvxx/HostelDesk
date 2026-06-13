import { DoorOpen } from "lucide-react"

export default function Movement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Movement</h1>
        <p className="text-sm text-muted-foreground">
          Track student check-outs and returns
        </p>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20">
        <DoorOpen className="size-12 text-muted-foreground/40" />
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          No movement logs yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Movement tracking will be available in a future update
        </p>
      </div>
    </div>
  )
}
