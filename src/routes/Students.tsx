import { Users, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Students() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground">
            Manage student records
          </p>
        </div>
        <Button disabled>
          <UserPlus className="size-4" data-icon="inline-start" />
          Add Student
        </Button>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20">
        <Users className="size-12 text-muted-foreground/40" />
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          Add your first student
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Student management will be available in a future update
        </p>
      </div>
    </div>
  )
}
