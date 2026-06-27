import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react"

interface BannerProps {
  type: "success" | "error" | "warning"
  message: string
}

export function Banner({ type, message }: BannerProps) {
  let colorClass = ""
  let Icon = AlertCircle

  if (type === "success") {
    colorClass = "bg-success/15 text-success"
    Icon = CheckCircle2
  } else if (type === "error") {
    colorClass = "bg-destructive/15 text-destructive"
    Icon = AlertCircle
  } else if (type === "warning") {
    colorClass = "bg-warning/15 text-warning-foreground"
    Icon = AlertTriangle
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-lg p-3 text-sm font-medium animate-in slide-in-from-top-2 ${colorClass}`}
    >
      <Icon className="size-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}
