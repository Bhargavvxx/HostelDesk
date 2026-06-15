import { useState, useEffect } from "react"
import { 
  WifiOff, 
  AlertCircle, 
  AlertTriangle, 
  Loader2, 
  CloudUpload, 
  CheckCircle2 
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useSyncStatus } from "@/sync/status"
import { useAuthStore } from "@/hooks/useAuthStore"
import { cn } from "@/lib/utils"

export function SyncIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const { isCloudSessionVerified } = useAuthStore()
  const { isSyncing, pendingCount, conflictCount, lastSyncAt } = useSyncStatus()

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  let state: "offline" | "unverified" | "conflict" | "syncing" | "pending" | "synced"
  
  // Exact precedence logic
  if (isOffline) {
    state = "offline"
  } else if (!isCloudSessionVerified) {
    state = "unverified"
  } else if (conflictCount > 0) {
    state = "conflict"
  } else if (isSyncing) {
    state = "syncing"
  } else if (pendingCount > 0) {
    state = "pending"
  } else {
    state = "synced"
  }

  // Visuals configuration map
  const config = {
    offline: {
      icon: WifiOff,
      label: "Offline",
      colorClass: "border-destructive/30 text-destructive bg-destructive/10",
      tooltip: "No internet connection. Changes saved locally.",
    },
    unverified: {
      icon: AlertCircle,
      label: "Unverified",
      colorClass: "border-orange-500/30 text-orange-600 bg-orange-500/10 dark:text-orange-400",
      tooltip: "Session unverified. Please log in to sync.",
    },
    conflict: {
      icon: AlertTriangle,
      label: `Conflict (${conflictCount})`,
      colorClass: "border-destructive/30 text-destructive bg-destructive/10",
      tooltip: `${conflictCount} item(s) need manual resolution.`,
    },
    syncing: {
      icon: Loader2,
      label: "Syncing...",
      colorClass: "border-blue-500/30 text-blue-600 bg-blue-500/10 dark:text-blue-400",
      tooltip: "Synchronizing with cloud...",
    },
    pending: {
      icon: CloudUpload,
      label: `Pending (${pendingCount})`,
      colorClass: "border-amber-500/30 text-amber-600 bg-amber-500/10 dark:text-amber-400",
      tooltip: `${pendingCount} item(s) waiting to upload.`,
    },
    synced: {
      icon: CheckCircle2,
      label: "Synced",
      colorClass: "border-emerald-500/30 text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
      tooltip: lastSyncAt ? `Last sync: ${new Date(lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Up to date.",
    },
  }

  const { icon: Icon, label, colorClass, tooltip } = config[state]

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 whitespace-nowrap overflow-hidden transition-colors duration-300", colorClass)}
      title={tooltip}
      aria-label={`${label} - ${tooltip}`}
    >
      <Icon className={cn("size-3.5 shrink-0", state === "syncing" && "animate-spin")} />
      {/* Always show text to ensure counts/states are visible on mobile */}
      <span className="text-[11px] font-medium leading-none">{label}</span>
    </Badge>
  )
}
