import { useState, useMemo } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { Users, Plus, AlertCircle, CheckCircle2 } from "lucide-react"
import { db } from "@/local/db"
import { Student } from "@/local/types"
import { archiveStudent, restoreStudent, deleteStudent } from "@/local/queries/students"
import { useAuthStore } from "@/hooks/useAuthStore"
import { StudentCard } from "@/components/students/StudentCard"
import { StudentFormModal } from "@/components/students/StudentFormModal"
import { StudentDetailModal } from "@/components/students/StudentDetailModal"
import { StudentDocumentsModal } from "@/components/students/StudentDocumentsModal"

type FilterType = "active" | "archived"

export default function Students() {
  const { ownerId } = useAuthStore()

  const [filter, setFilter] = useState<FilterType>("active")
  
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

  // Reactive query
  const allStudents = useLiveQuery(() => db.students.where("deleted").equals(0).sortBy("first_name"), [])

  const filteredStudents = useMemo(() => {
    if (!allStudents) return []
    return allStudents.filter(s => s.status === filter)
  }, [allStudents, filter])

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
      {/* Header */}
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

      {/* Local Banner */}
      {banner && (
        <div 
          className={`flex items-center gap-2 rounded-lg p-3 text-sm font-medium animate-in slide-in-from-top-2 ${
            banner.type === "success" 
              ? "bg-success/15 text-success" 
              : "bg-destructive/15 text-destructive"
          }`}
        >
          {banner.type === "success" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
          {banner.msg}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex w-full items-center gap-1 rounded-lg bg-muted p-1 sm:w-fit">
        {(["active", "archived"] as FilterType[]).map((tab) => (
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

      {/* Student Grid */}
      {filteredStudents.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStudents.map((student) => (
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
      ) : (
        /* Empty State */
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center animate-in fade-in-50">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Users className="size-6 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No students found</h2>
          <p className="mt-2 mb-6 text-sm text-muted-foreground max-w-[250px]">
            {filter === "active" 
              ? "You haven't added any students yet."
              : `There are no ${filter} students.`}
          </p>
          {filter === "active" ? (
            <button
              onClick={handleAddNew}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              Add your first student
            </button>
          ) : (
            <button
              onClick={() => setFilter("active")}
              className="text-sm font-medium text-primary hover:underline"
            >
              View active students
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      <StudentFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        student={selectedStudent}
        onSuccess={(msg) => showBanner("success", msg)}
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
