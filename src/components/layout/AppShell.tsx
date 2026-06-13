import { type ReactNode } from "react"
import { BottomNav } from "./BottomNav"
import { Sidebar } from "./Sidebar"
import { SyncIndicator } from "./SyncIndicator"
import { ThemeToggle } from "./ThemeToggle"

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh bg-background text-foreground">
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar className="hidden md:flex" />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header — visible only on mobile */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              HD
            </div>
            <span className="text-base font-semibold tracking-tight">
              HostelDesk
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <SyncIndicator />
            <ThemeToggle />
          </div>
        </header>

        {/* Page content — scrollable, padded, max-width constrained */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-[680px] px-4 py-4 md:max-w-[1040px] md:px-6 md:py-6">
            {children}
          </div>
        </main>

        {/* Mobile bottom nav — hidden on desktop */}
        <BottomNav className="md:hidden" />
      </div>
    </div>
  )
}
