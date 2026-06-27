import { useState, useMemo } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { Users, Plus, AlertCircle, CheckCircle2, Search, X } from "lucide-react"
import { db } from "@/local/db"
import { Student } from "@/local/types"
import { archiveStudent, restoreStudent, deleteStudent } from "@/local/queries/students"
import { useAuthStore } from "@/hooks/useAuthStore"
import { StudentCard } from "@/components/students/StudentCard"
import { StudentFormModal } from "@/components/students/StudentFormModal"
import { StudentDetailModal } from "@/components/students/StudentDetailModal"
import { StudentDocumentsModal } from "@/components/students/StudentDocumentsModal"

type FilterType = "active" | "archived"

// Skeleton placeholder for loading state
function StudentCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm animate-pulse">
      <div className="flex items-start gap-4">
        <div className="size-14 shrink-0 rounded-full bg-muted" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted" />
          <div className="flex gap-2 pt-1">
            <div className="h-5 w-14 rounded-full bg-muted" />
            <div className="h-5 w-16 rounded-full bg-muted" />
          </div>
        </div>
      </div>
      <div className="mt-auto border-t border-border/50 pt-2 flex justify-between">
        <div className="flex gap-1">
          <div className="size-7 rounded-md bg-muted" />
          <div className="size-7 rounded-md bg-muted" />
        </div>
        <div className="flex gap-1">
          <div className="h-7 w-12 rounded-md bg-muted" />
          <div className="h-7 w-16 rounded-md bg-muted" />
        </div>
      </div>
    </div>
  )
}

export default function Students() {
  const { ownerId } = useAuthStore()

  const [filter, setFilter] = useState<FilterType>("active")
  const [searchQuery, setSearchQuery] = useState("")
  const [roomFilter, setRoomFilter] = useState("")

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isDocsOpen, setIsDocsOpen] = useState(false)

  const [selectedStudent, setSelectedStudent] = useState<Student | undefined>(undefined)

  const [banner, setBanner] = useState<{ type: "success" | "error"; msg: string } | null>(null)

  const showBanner = (type: "success" | "error", msg: string) => {
    setBanner({ type, msg })
    setTimeout(() => setBanner(null), 3000)
  }

  // --- Reactive Dexie queries ---
  // Returns undefined while hydrating, [] when empty, [rows] when populated
  const allStudents = useLiveQuery(
    () => db.students.where("deleted").equals(0).sortBy("first_name"),
    []
  )

  const activeRooms = useLiveQuery(
    () => db.rooms.where("deleted").equals(0).filter(r => r.status === "active").sortBy("room_number"),
    []
  )

  // --- In-memory filtering (AND logic: status + search + room) ---
  const filteredStudents = useMemo(() => {
    if (!allStudents) return null // still loading

    const q = searchQuery.trim().toLowerCase()

    return allStudents.filter(s => {
      // 1. Status tab
      if (s.status !== filter) return false

      // 2. Name/phone search (substring, case-insensitive)
      if (q) {
        const fullName = `${s.first_name} ${s.last_name}`.toLowerCase()
        const phone = s.phone.toLowerCase()
        if (!fullName.includes(q) && !phone.includes(q)) return false
      }

      // 3. Room filter
      if (roomFilter && s.room_id !== roomFilter) return false

      return true
    })
  }, [allStudents, filter, searchQuery, roomFilter])

  const isLoading = filteredStudents === null
  const isDbEmpty = !isLoading && allStudents?.length === 0
  const isFilteredEmpty = !isLoading && !isDbEmpty && filteredStudents?.length === 0
  const hasActiveFilters = searchQuery.trim() !== "" || roomFilter !== ""


  // --- Handlers ---
  const handleAddNew = () => {
    setSelectedStudent(undefined)
    setIsFormOpen(true)
  }

  const handleEdit = (student: Student) => {
    setSelectedStudent(student)
    setIsFormOpen(true)
  }

  const handleViewInfo = (student: Student) => {
    setSelectedStudent(student)
    setIsDetailOpen(true)
  }

  const handleViewDocs = (student: Student) => {
    setSelectedStudent(student)
    setIsDocsOpen(true)
  }

  const handleArchive = async (student: Student) => {
    if (!ownerId) return
    if (window.confirm(`Archive ${student.first_name}? They will be unassigned from their room.`)) {
      try {
        await archiveStudent(student.id, ownerId)
        showBanner("success", `${student.first_name} archived`)
      } catch (err: any) {
        showBanner("error", err.message || "Failed to archive student")
      }
    }
  }

  const handleRestore = async (student: Student) => {
    if (!ownerId) return
    if (window.confirm(`Restore ${student.first_name}?`)) {
      try {
        await restoreStudent(student.id, ownerId)
        showBanner("success", `${student.first_name} restored`)
      } catch (err: any) {
        showBanner("error", err.message || "Failed to restore student")
      }
    }
  }

  const handleDelete = async (student: Student) => {
    if (!ownerId) return
    if (window.confirm(`Permanently delete ${student.first_name}? This cannot be undone.`)) {
      try {
        await deleteStudent(student.id, ownerId)
        showBanner("success", `${student.first_name} deleted`)
      } catch (err: any) {
        showBanner("error", err.message || "Failed to delete student")
      }
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-6 lg:p-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Students</h1>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Add Student</span>
        </button>
      </div>

      {/* ── Success / Error Banner ── */}
      {banner && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm font-medium animate-in slide-in-from-top-2 ${
            banner.type === "success"
              ? "bg-success/15 text-success"
              : "bg-destructive/15 text-destructive"
          }`}
        >
          {banner.type === "success"
            ? <CheckCircle2 className="size-4 shrink-0" />
            : <AlertCircle className="size-4 shrink-0" />}
          {banner.msg}
        </div>
      )}

      {/* ── Search + Room Filter ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            id="student-search"
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or phone…"
            className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-9 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Room filter dropdown */}
        <select
          id="student-room-filter"
          value={roomFilter}
          onChange={e => setRoomFilter(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground min-w-[140px]"
        >
          <option value="">All rooms</option>
          {activeRooms?.map(r => (
            <option key={r.id} value={r.id}>
              Room {r.room_number}
            </option>
          ))}
        </select>
      </div>

      {/* ── Status Tabs ── */}
      <div className="flex w-full items-center gap-1 rounded-lg bg-muted p-1 sm:w-fit">
        {(["active", "archived"] as FilterType[]).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-all sm:flex-none ${
              filter === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Content Area ── */}

      {/* Loading state: Dexie not yet hydrated */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StudentCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty DB state: zero students exist at all */}
      {isDbEmpty && (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center animate-in fade-in-50">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Users className="size-6 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No students yet</h2>
          <p className="mt-2 mb-6 text-sm text-muted-foreground max-w-[240px]">
            Add your first student to get started.
          </p>
          <button
            onClick={handleAddNew}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Add your first student
          </button>
        </div>
      )}

      {/* Filtered-empty state: DB has rows but no results match */}
      {isFilteredEmpty && (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center animate-in fade-in-50">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Search className="size-6 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No students match</h2>
          <p className="mt-2 mb-6 text-sm text-muted-foreground max-w-[240px]">
            {hasActiveFilters
              ? "Try adjusting your search or room filter."
              : filter === "archived"
                ? "There are no archived students."
                : "There are no active students."}
          </p>
          <div className="flex flex-col items-center gap-2 sm:flex-row">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Clear search
              </button>
            )}
            {roomFilter && (
              <button
                onClick={() => setRoomFilter("")}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Clear room filter
              </button>
            )}
            {filter === "archived" && !hasActiveFilters && (
              <button
                onClick={() => setFilter("active")}
                className="text-sm font-medium text-primary hover:underline"
              >
                View active students
              </button>
            )}
          </div>
        </div>
      )}

      {/* Student card grid */}
      {!isLoading && filteredStudents && filteredStudents.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStudents.map(student => (
            <StudentCard
              key={student.id}
              student={student}
              onEdit={handleEdit}
              onArchive={handleArchive}
              onRestore={handleRestore}
              onDelete={handleDelete}
              onViewInfo={handleViewInfo}
              onViewDocs={handleViewDocs}
            />
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      <StudentFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        student={selectedStudent}
        onSuccess={msg => showBanner("success", msg)}
      />

      <StudentDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        student={selectedStudent}
      />

      <StudentDocumentsModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
        student={selectedStudent}
      />
    </div>
  )
}
