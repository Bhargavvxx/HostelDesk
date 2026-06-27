import { useState, useMemo, useEffect } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import {
  Users,
  DoorOpen,
  IndianRupee,
  BedDouble,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { db } from "@/local/db"
import { computeMovementStatus } from "@/local/queries/movement"
import { computeStudentFeeStats } from "@/local/queries/fees"
import { getISTDateKey, nowUTCISO } from "@/local/helpers"
import { FeeRecord } from "@/local/types"

// Reminder structure
type Reminder = {
  id: string
  type: "danger" | "warning"
  message: string
}

export default function Dashboard() {
  const [tick, setTick] = useState(0)
  
  // 60-second tick for real-time movement overdue checking
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  // Mostly stable, but technically could change if app left open overnight
  const todayIST = useMemo(() => getISTDateKey(), [tick]) 
  const currentUTC = useMemo(() => nowUTCISO(), [tick])

  // --- Live Queries ---
  const activeStudents = useLiveQuery(
    () => db.students.where("deleted").equals(0).filter(s => s.status === "active").toArray(),
    []
  )

  const activeRooms = useLiveQuery(
    () => db.rooms.where("deleted").equals(0).filter(r => r.status === "active").toArray(),
    []
  )

  const todayAttendance = useLiveQuery(
    () => db.attendance.where("date").equals(todayIST).filter(a => !a.deleted).toArray(),
    [todayIST]
  )

  const openMovementLogs = useLiveQuery(
    () => db.movement_logs.where("is_open").equals(1).filter(l => !l.deleted).toArray(),
    []
  )

  const feeRecords = useLiveQuery(
    () => db.fee_records.filter(f => !f.deleted).toArray(),
    []
  )

  // --- Computations ---
  const isLoading = !activeStudents || !activeRooms || !todayAttendance || !openMovementLogs || !feeRecords

  const dashboardData = useMemo(() => {
    if (isLoading) return null

    // 1. Basic Sets
    const activeStudentIds = new Set(activeStudents.map(s => s.id))
    
    // 2. Attendance Stats
    const activeAttendance = todayAttendance.filter(a => activeStudentIds.has(a.student_id))
    const presentTodayCount = activeAttendance.filter(a => a.status === "present").length
    const attendanceMissingCount = activeStudents.length - activeAttendance.length

    // 3. Movement Stats
    let outCount = 0
    let overdueReturnCount = 0
    const movementReminders: Reminder[] = []
    
    for (const log of openMovementLogs) {
      if (!activeStudentIds.has(log.student_id)) continue
      const status = computeMovementStatus(log, currentUTC)
      if (status === "out") outCount++
      if (status === "overdue") {
        overdueReturnCount++
        const student = activeStudents.find(s => s.id === log.student_id)
        if (student) {
          movementReminders.push({
            id: `mov_${log.id}`,
            type: "danger",
            message: `${student.first_name} ${student.last_name} is overdue for return.`
          })
        }
      }
    }

    // 4. Fee Stats
    let totalBalanceDue = 0
    const feeReminders: Reminder[] = []
    
    const feesByStudentId: Record<string, FeeRecord[]> = {}
    for (const fee of feeRecords) {
      if (activeStudentIds.has(fee.student_id)) {
        if (!feesByStudentId[fee.student_id]) feesByStudentId[fee.student_id] = []
        feesByStudentId[fee.student_id]!.push(fee)
      }
    }

    for (const student of activeStudents) {
      const records = feesByStudentId[student.id] || []
      const stats = computeStudentFeeStats(records, todayIST)
      
      totalBalanceDue += Math.max(stats.studentBalance, 0)
      
      if (stats.overdueBalance > 0) {
        feeReminders.push({
          id: `fee_${student.id}`,
          type: "danger",
          message: `${student.first_name} ${student.last_name} has overdue fees of ₹${stats.overdueBalance}.`
        })
      }
    }

    // 5. Room Stats
    let totalCapacity = 0
    for (const room of activeRooms) {
      totalCapacity += room.capacity
    }
    
    let assignedActiveCount = 0
    const roomAssignedCounts: Record<string, number> = {}
    for (const student of activeStudents) {
      if (student.room_id) {
        assignedActiveCount++
        roomAssignedCounts[student.room_id] = (roomAssignedCounts[student.room_id] || 0) + 1
      }
    }
    
    const freeBeds = Math.max(totalCapacity - assignedActiveCount, 0)
    
    const roomReminders: Reminder[] = []
    for (const room of activeRooms) {
      const count = roomAssignedCounts[room.id] || 0
      if (count > room.capacity) {
        roomReminders.push({
          id: `rm_${room.id}`,
          type: "danger",
          message: `Room ${room.room_number} is over capacity (${count}/${room.capacity}).`
        })
      }
    }

    // 6. Build Reminders List
    const allReminders: Reminder[] = [
      ...movementReminders,
      ...feeReminders,
      ...roomReminders,
    ]
    
    if (attendanceMissingCount > 0) {
      allReminders.push({
        id: "att_missing",
        type: "warning",
        message: `${attendanceMissingCount} active student${attendanceMissingCount > 1 ? 's have' : ' has'} not been marked for today's attendance.`
      })
    }
    
    // Sort so danger is first
    allReminders.sort((a, b) => (a.type === "danger" ? -1 : 1) - (b.type === "danger" ? -1 : 1))

    return {
      activeStudentsCount: activeStudents.length,
      presentTodayCount,
      outCount,
      overdueReturnCount,
      totalBalanceDue,
      freeBeds,
      reminders: allReminders
    }
  }, [isLoading, activeStudents, activeRooms, todayAttendance, openMovementLogs, feeRecords, currentUTC, todayIST])

  // --- Rendering ---
  const renderStat = (val?: number | string) => val !== undefined ? val : "—"

  return (
    <div className="space-y-6 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your hostel at a glance
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {renderStat(dashboardData?.activeStudentsCount)}
              </p>
              <p className="text-xs text-muted-foreground">Active Students</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-success/15 text-success">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {renderStat(dashboardData?.presentTodayCount)}
              </p>
              <p className="text-xs text-muted-foreground">Present Today</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-info/15 text-info">
              <BedDouble className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {renderStat(dashboardData?.freeBeds)}
              </p>
              <p className="text-xs text-muted-foreground">Free Beds</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-warning/20 text-warning-foreground">
              <DoorOpen className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {renderStat(dashboardData?.outCount)}
              </p>
              <p className="text-xs text-muted-foreground">Out Now</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
              <DoorOpen className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {renderStat(dashboardData?.overdueReturnCount)}
              </p>
              <p className="text-xs text-muted-foreground">Overdue Returns</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <IndianRupee className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {dashboardData ? `₹${dashboardData.totalBalanceDue}` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Total Dues</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reminders List */}
      <h2 className="text-lg font-semibold tracking-tight mt-8 mb-4">Urgent Reminders</h2>
      
      {!dashboardData ? (
        <Card className="shadow-card animate-pulse border-dashed">
          <CardContent className="p-8 flex justify-center text-muted-foreground">
            Loading reminders...
          </CardContent>
        </Card>
      ) : dashboardData.reminders.length === 0 ? (
        <Card className="shadow-card border-dashed">
          <CardContent className="p-10 flex flex-col items-center justify-center text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success mb-3">
              <CheckCircle2 className="size-6" />
            </div>
            <p className="text-sm font-medium text-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground mt-1">There are no urgent reminders at this time.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {dashboardData.reminders.map(rem => (
            <div
              key={rem.id}
              className={`flex items-start gap-3 rounded-lg border p-4 shadow-sm transition-colors ${
                rem.type === "danger"
                  ? "bg-destructive/5 border-destructive/20 text-destructive-foreground"
                  : "bg-warning/5 border-warning/30 text-warning-foreground"
              }`}
            >
              {rem.type === "danger" ? (
                <AlertCircle className="size-5 shrink-0 text-destructive mt-0.5" />
              ) : (
                <AlertTriangle className="size-5 shrink-0 text-warning-foreground mt-0.5" />
              )}
              <p className="text-sm font-medium pt-0.5">{rem.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
