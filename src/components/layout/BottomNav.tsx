import { NavLink } from "react-router"
import {
  LayoutDashboard,
  Users,
  DoorOpen,
  IndianRupee,
  MoreHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/students", icon: Users, label: "Students" },
  { to: "/movement", icon: DoorOpen, label: "Movement" },
  { to: "/fees", icon: IndianRupee, label: "Fees" },
  { to: "/more", icon: MoreHorizontal, label: "More" },
]

export function BottomNav({ className }: { className?: string }) {
  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-border bg-card/95 backdrop-blur-sm",
        className
      )}
    >
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            cn(
              "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors duration-150",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )
          }
        >
          <Icon className="size-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
