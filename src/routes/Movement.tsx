import { useState, useMemo, useEffect } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { DoorOpen, Plus } from "lucide-react"
import { db } from "@/local/db"
import { checkIn } from "@/local/queries/movement"
import { MovementLog } from "@/local/types"
import { useAuthStore } from "@/hooks/useAuthStore"
import { MovementRow } from "@/components/movement/MovementRow"
import { MovementFormModal } from "@/components/movement/MovementFormModal"
import { Banner } from "@/components/common/Banner"
import { EmptyState } from "@/components/common/EmptyState"

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
      {banner && <Banner type={banner.type} message={banner.msg} />}

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
        <EmptyState
          icon={DoorOpen}
          title="Select a student"
          description="Choose a student above to log a check-out or check-in."
        />
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
            <EmptyState
              icon={DoorOpen}
              title="No movement history"
              description="No movement history for this student."
              action={{ label: "Check out now", onClick: handleCheckOut }}
            />
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
