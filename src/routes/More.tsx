import { Link } from "react-router"
import {
  CalendarCheck,
  BedDouble,
  Download,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

const menuItems = [
  {
    to: "/attendance",
    icon: CalendarCheck,
    label: "Attendance",
    description: "Daily roll call",
  },
  {
    to: "/rooms",
    icon: BedDouble,
    label: "Rooms",
    description: "Room allocation & capacity",
  },
  {
    to: "/backup",
    icon: Download,
    label: "Backup & Export",
    description: "CSV, Excel, JSON, Drive",
  },
]

export default function More() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">More</h1>
        <p className="text-sm text-muted-foreground">
          Additional features and settings
        </p>
      </div>

      <div className="space-y-1">
        {menuItems.map(({ to, icon: Icon, label, description }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex min-h-[56px] items-center gap-4 rounded-xl px-4 py-3",
              "text-foreground transition-colors duration-150",
              "hover:bg-muted active:scale-[0.98]"
            )}
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  )
}
