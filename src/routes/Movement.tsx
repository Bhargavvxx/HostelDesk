import { useState, useMemo, useEffect } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { DoorOpen, Plus, AlertCircle, CheckCircle2 } from "lucide-react"
import { db } from "@/local/db"
import { checkIn } from "@/local/queries/movement"
import { MovementLog } from "@/local/types"
import { useAuthStore } from "@/hooks/useAuthStore"
import { MovementRow } from "@/components/movement/MovementRow"
import { MovementFormModal } from "@/components/movement/MovementFormModal"

export default function Movement() {
  const { ownerId } = useAuthStore()

  const [selectedStudentId, setSelectedStudentId] = useState<string>("")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [checkingInId, setCheckingInId] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ type: "success" | "error"; msg: string } | null>(null)

  const showBanner = (type: "success" | "error", msg: string) => {
    setBanner({ type, msg })
    setTimeout(() => setBanner(null), 3500)
  }

  // Active students for picker
  const allStudents = useLiveQuery(
    () => db.students
      .where("deleted").equals(0)
      .filter(s => s.status === "active")
      .sortBy("first_name"),
    []
  )

  // Movement logs for selected student
  const studentLogs = useLiveQuery<MovementLog[]>(
    () => {
      if (!selectedStudentId) return Promise.resolve([] as MovementLog[])
      return db.movement_logs
        .where("student_id").equals(selectedStudentId)
        .filter(l => !l.deleted)
        .toArray()
    },
    [selectedStudentId]
  )

  // Force re-render periodically to update overdue status if time passes while page is open
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000) // every minute
    return () => clearInterval(timer)
  }, [])

  const sortedLogs = useMemo(() => {
    if (!studentLogs) return []
    return [...studentLogs].sort((a, b) => {
      // open logs first, then by check_out_time descending
      if (a.is_open && !b.is_open) return -1
      if (!a.is_open && b.is_open) return 1
      return b.check_out_time.localeCompare(a.check_out_time)
    })
  }, [studentLogs])

  const selectedStudent = useMemo(
    () => allStudents?.find(s => s.id === selectedStudentId),
    [allStudents, selectedStudentId]
  )

  const hasOpenLog = useMemo(() => {
    return sortedLogs.some(l => l.is_open)
  }, [sortedLogs])

  const handleCheckOut = () => {
    setIsFormOpen(true)
  }

  const handleCheckIn = async (logId: string) => {
    if (!ownerId) return
    setCheckingInId(logId)
    try {
      await checkIn(logId, ownerId)
      showBanner("success", navigator.onLine ? "Checked in successfully ✓" : "Checked in — will sync when online")
    } catch (err: any) {
      showBanner("error", err.message || "Failed to check in.")
    } finally {
      setCheckingInId(null)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-6 lg:p-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Movement</h1>
        {selectedStudentId && !hasOpenLog && (
          <button
            onClick={handleCheckOut}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Check Out</span>
          </button>
        )}
      </div>

      {/* ── Banner ── */}
      {banner && (
        <div className={`flex items-center gap-2 rounded-lg p-3 text-sm font-medium animate-in slide-in-from-top-2 ${
          banner.type === "success" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
        }`}>
          {banner.type === "success"
            ? <CheckCircle2 className="size-4 shrink-0" />
            : <AlertCircle className="size-4 shrink-0" />}
          {banner.msg}
        </div>
      )}

      {/* ── Student Picker ── */}
      <div className="space-y-1.5">
        <label htmlFor="student-picker" className="text-sm font-medium">
          Select Student
        </label>
        <select
          id="student-picker"
          value={selectedStudentId}
          onChange={e => setSelectedStudentId(e.target.value)}
          className="flex h-11 w-full max-w-sm rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">— Select a student —</option>
          {allStudents?.map(s => (
            <option key={s.id} value={s.id}>
              {s.first_name} {s.last_name}
            </option>
          ))}
        </select>
      </div>

      {/* ── No student selected ── */}
      {!selectedStudentId && (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center animate-in fade-in-50">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <DoorOpen className="size-6 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Select a student</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-[240px]">
            Choose a student above to log a check-out or check-in.
          </p>
        </div>
      )}

      {/* ── Student selected ── */}
      {selectedStudentId && selectedStudent && (
        <div className="flex flex-col gap-4">
          
          {hasOpenLog && (
            <div className="rounded-lg bg-warning/10 border border-warning/20 p-4 text-sm font-medium text-warning-foreground">
              This student is currently checked out. They must be checked in before another check-out can be logged.
            </div>
          )}

          {/* Movement list */}
          {sortedLogs.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Recent Logs</h3>
              {sortedLogs.map(log => (
                <MovementRow
                  key={log.id}
                  log={log}
                  onCheckIn={handleCheckIn}
                  isCheckingIn={checkingInId === log.id}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center animate-in fade-in-50 mt-4">
              <DoorOpen className="size-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                No movement history for this student.
              </p>
              <button
                onClick={handleCheckOut}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
              >
                Check out now
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Modal ── */}
      {selectedStudentId && (
        <MovementFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          studentId={selectedStudentId}
          onSuccess={msg => showBanner("success", msg)}
        />
      )}
    </div>
  )
}
