import { useState, useMemo } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { Calendar, CalendarCheck, Users } from "lucide-react"
import { db } from "@/local/db"
import { markAttendance, bulkMarkAttendance, getLeaveSuggestion } from "@/local/queries/attendance"
import { getISTDateKey } from "@/local/helpers"
import { useAuthStore } from "@/hooks/useAuthStore"
import { AttendanceRow } from "@/components/attendance/AttendanceRow"
import { Banner } from "@/components/common/Banner"
import { EmptyState } from "@/components/common/EmptyState"

// Importing proper types
import type { Attendance as AttendanceType } from "@/local/types"
import type { BulkAttendanceSelection as BulkSel } from "@/local/queries/attendance"

export default function Attendance() {
  const { ownerId } = useAuthStore()

  // Default to today IST
  const [selectedDate, setSelectedDate] = useState(getISTDateKey())
  
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [isBulkMarking, setIsBulkMarking] = useState(false)
  const [banner, setBanner] = useState<{ type: "success" | "error"; msg: string } | null>(null)

  const showBanner = (type: "success" | "error", msg: string) => {
    setBanner({ type, msg })
    setTimeout(() => setBanner(null), 3500)
  }

  // 1. All Active Students
  const activeStudents = useLiveQuery(
    () => db.students
      .where("deleted").equals(0)
      .filter(s => s.status === "active")
      .sortBy("first_name"),
    []
  )

  // 2. All Attendance records for the selected date
  const dateAttendance = useLiveQuery(
    () => db.attendance
      .where("date").equals(selectedDate)
      .filter(a => !a.deleted)
      .toArray(),
    [selectedDate]
  )

  // 3. All relevant movement logs (to calculate leave suggestions)
  const allMovementLogs = useLiveQuery(
    () => db.movement_logs.filter(l => !l.deleted && (l.type === "overnight" || l.type === "home_visit")).toArray(),
    []
  )

  // Map attendance by student ID
  const attendanceByStudentId = useMemo(() => {
    const map: Record<string, AttendanceType> = {}
    if (dateAttendance) {
      for (const record of dateAttendance) {
        map[record.student_id] = record
      }
    }
    return map
  }, [dateAttendance])

  // Map movement logs by student ID
  const movementLogsByStudentId = useMemo(() => {
    const map: Record<string, typeof allMovementLogs> = {}
    if (allMovementLogs) {
      for (const log of allMovementLogs) {
        if (!map[log.student_id]) map[log.student_id] = []
        map[log.student_id]!.push(log)
      }
    }
    return map
  }, [allMovementLogs])

  const handleMark = async (studentId: string, status: AttendanceType["status"]) => {
    if (!ownerId) return
    setProcessingId(studentId)
    try {
      await markAttendance({ studentId, date: selectedDate, status }, ownerId)
    } catch (err: any) {
      showBanner("error", err.message || "Failed to mark attendance.")
    } finally {
      setProcessingId(null)
    }
  }

  const handleBulkMarkPresent = async () => {
    if (!ownerId || !activeStudents) return
    setIsBulkMarking(true)
    
    try {
      const selections: BulkSel[] = []
      
      for (const student of activeStudents) {
        // Only target students without an existing record for this date
        if (!attendanceByStudentId[student.id]) {
          const logs = movementLogsByStudentId[student.id] || []
          const suggestedLeave = getLeaveSuggestion(logs as any, selectedDate)
          
          selections.push({
            studentId: student.id,
            status: suggestedLeave ? "leave" : "present"
          })
        }
      }

      if (selections.length === 0) {
        showBanner("success", "All students are already marked for this date.")
        setIsBulkMarking(false)
        return
      }

      await bulkMarkAttendance(selectedDate, selections, ownerId)
      const isOffline = !navigator.onLine
      showBanner("success", isOffline ? "Marked all — will sync when online" : "Marked all successfully ✓")

    } catch (err: any) {
      showBanner("error", err.message || "Failed bulk mark operation.")
    } finally {
      setIsBulkMarking(false)
    }
  }

  // Calculate stats
  const stats = useMemo(() => {
    if (!activeStudents || !dateAttendance) return null
    const total = activeStudents.length
    const marked = dateAttendance.length
    const presentCount = dateAttendance.filter(a => a.status === "present").length
    const absentCount = dateAttendance.filter(a => a.status === "absent").length
    const leaveCount = dateAttendance.filter(a => a.status === "leave").length
    const lateCount = dateAttendance.filter(a => a.status === "late").length
    
    return { total, marked, presentCount, absentCount, leaveCount, lateCount }
  }, [activeStudents, dateAttendance])

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-6 lg:p-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Attendance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mark student roll call for a specific date
          </p>
        </div>
        
        {/* Date Picker */}
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="flex h-10 w-full sm:w-[160px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:[color-scheme:dark]"
          />
        </div>
      </div>

      {/* Banner */}
      {banner && <Banner type={banner.type} message={banner.msg} />}

      {/* Stats & Bulk Action */}
      {stats && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Marked:</span>{" "}
              <span className="font-semibold">{stats.marked} / {stats.total}</span>
            </div>
            {stats.marked > 0 && (
              <>
                <div className="text-success font-medium">P: {stats.presentCount}</div>
                <div className="text-destructive font-medium">A: {stats.absentCount}</div>
                <div className="text-warning-foreground font-medium">L: {stats.leaveCount}</div>
                <div className="text-indigo-500 font-medium">Lt: {stats.lateCount}</div>
              </>
            )}
          </div>
          
          <button
            onClick={handleBulkMarkPresent}
            disabled={isBulkMarking || stats.marked === stats.total || !activeStudents || activeStudents.length === 0}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <CalendarCheck className="size-4" />
            {isBulkMarking ? "Marking..." : "Mark All Unmarked"}
          </button>
        </div>
      )}

      {/* Student List */}
      <div className="flex flex-col gap-2 flex-1 overflow-y-auto pb-8">
        {!activeStudents ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">Loading...</div>
        ) : activeStudents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No active students"
            description="Add students first to track attendance."
          />
        ) : (
          activeStudents.map(student => {
            const record = attendanceByStudentId[student.id]
            const logs = movementLogsByStudentId[student.id] || []
            const suggestedLeave = getLeaveSuggestion(logs as any, selectedDate)

            return (
              <AttendanceRow
                key={student.id}
                student={student}
                record={record}
                suggestedLeave={suggestedLeave}
                onMark={(status) => handleMark(student.id, status)}
                isMarking={processingId === student.id || isBulkMarking}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
