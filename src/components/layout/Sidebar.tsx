import { NavLink } from "react-router"
import {
  LayoutDashboard,
  Users,
  DoorOpen,
  IndianRupee,
  MoreHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "./ThemeToggle"
import { SyncIndicator } from "./SyncIndicator"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/students", icon: Users, label: "Students" },
  { to: "/movement", icon: DoorOpen, label: "Movement" },
  { to: "/fees", icon: IndianRupee, label: "Fees" },
  { to: "/more", icon: MoreHorizontal, label: "More" },
]

export function Sidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "flex w-60 shrink-0 flex-col border-r border-border bg-card",
        className
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
          HD
        </div>
        <span className="text-lg font-semibold tracking-tight">HostelDesk</span>
      </div>

      {/* Navigation links */}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <Icon className="size-5 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer — sync indicator + theme toggle */}
      <div className="flex flex-col gap-3 border-t border-border p-3">
        <SyncIndicator />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}
