import { HardDriveDownload } from "lucide-react"
import { Badge } from "@/components/ui/badge"

/**
 * Placeholder sync indicator.
 * Shows "Local mode" until the sync engine is implemented in TICKET-05/06.
 */
export function SyncIndicator() {
  return (
    <Badge
      variant="outline"
      className="gap-1.5 border-info/30 text-info"
    >
      <HardDriveDownload className="size-3" />
      <span>Local mode</span>
    </Badge>
  )
}
