import {
  LayoutDashboard,
  Users,
  DoorOpen,
  IndianRupee,
  BedDouble,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const stats = [
  { label: "Present Today", icon: Users, color: "text-success" },
  { label: "Out Now", icon: DoorOpen, color: "text-warning" },
  { label: "Overdue Returns", icon: DoorOpen, color: "text-destructive" },
  { label: "Total Dues", icon: IndianRupee, color: "text-primary" },
  { label: "Free Beds", icon: BedDouble, color: "text-info" },
]

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your hostel at a glance
        </p>
      </div>

      {/* Stat tiles — placeholder values */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, icon: Icon, color }) => (
          <Card key={label} className="shadow-card">
            <CardContent className="flex items-center gap-4">
              <div
                className={`flex size-10 items-center justify-center rounded-xl bg-primary/10 ${color}`}
              >
                <Icon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">—</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Placeholder for reminders / out-now list */}
      <Card className="shadow-card">
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10">
            <LayoutDashboard className="size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              Live data will appear here once students are added
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
