import { IndianRupee } from "lucide-react"

export default function Fees() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fees</h1>
        <p className="text-sm text-muted-foreground">
          Record payments and track dues
        </p>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20">
        <IndianRupee className="size-12 text-muted-foreground/40" />
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          No fee records yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Fee management will be available in a future update
        </p>
      </div>
    </div>
  )
}
