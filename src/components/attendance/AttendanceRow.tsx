import { Student, Attendance } from "@/local/types"
import { Check, X, Plane, Clock } from "lucide-react"

interface AttendanceRowProps {
  student: Student
  record?: Attendance
  suggestedLeave: boolean
  onMark: (status: Attendance["status"]) => void
  isMarking?: boolean
}

export function AttendanceRow({ student, record, suggestedLeave, onMark, isMarking }: AttendanceRowProps) {
  
  const currentStatus = record?.status

  // A visually distinct state if they have NO record yet, but are suggested leave
  const isSuggested = !record && suggestedLeave

  const buttonClass = (isActive: boolean, colorClass: string, isDim: boolean = false) => `
    relative flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-all
    ${isActive 
      ? colorClass 
      : isDim 
        ? "border-dashed border-border bg-transparent opacity-50 hover:opacity-100 hover:bg-muted" 
        : "border-border bg-transparent text-muted-foreground hover:bg-muted"}
    ${isMarking ? "opacity-50 pointer-events-none" : ""}
  `

  return (
    <div className={`flex flex-col gap-3 rounded-lg border p-4 transition-colors ${
      isSuggested ? "border-warning/50 bg-warning/5" : "border-border bg-card"
    }`}>
      {/* Student Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{student.first_name} {student.last_name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {student.phone}
          </p>
          {isSuggested && (
            <p className="text-xs font-medium text-warning-foreground mt-1">
              Suggested: On Leave (Open Movement Log)
            </p>
          )}
        </div>

        {/* Action Toggles */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => onMark("present")}
            className={buttonClass(currentStatus === "present", "border-success bg-success/15 text-success")}
            disabled={isMarking}
          >
            <Check className="size-3.5" />
            <span className="hidden sm:inline">Present</span>
          </button>
          
          <button
            onClick={() => onMark("absent")}
            className={buttonClass(currentStatus === "absent", "border-destructive bg-destructive/15 text-destructive")}
            disabled={isMarking}
          >
            <X className="size-3.5" />
            <span className="hidden sm:inline">Absent</span>
          </button>

          <button
            onClick={() => onMark("leave")}
            className={buttonClass(currentStatus === "leave", "border-warning bg-warning/20 text-warning-foreground", isSuggested)}
            disabled={isMarking}
          >
            <Plane className="size-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>

          <button
            onClick={() => onMark("late")}
            className={buttonClass(currentStatus === "late", "border-indigo-500/50 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400")}
            disabled={isMarking}
          >
            <Clock className="size-3.5" />
            <span className="hidden sm:inline">Late</span>
          </button>
        </div>
      </div>
    </div>
  )
}
