import { useState, useMemo } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { IndianRupee, Plus } from "lucide-react"
import { db } from "@/local/db"
import { FeeRecord } from "@/local/types"
import { deleteFee } from "@/local/queries/fees"
import { useAuthStore } from "@/hooks/useAuthStore"
import { FeeRow } from "@/components/fees/FeeRow"
import { FeeFormModal } from "@/components/fees/FeeFormModal"
import { StudentBalanceSummary } from "@/components/fees/StudentBalanceSummary"
import { Banner } from "@/components/common/Banner"
import { EmptyState } from "@/components/common/EmptyState"

export default function Fees() {
  const { ownerId } = useAuthStore()

  const [selectedStudentId, setSelectedStudentId] = useState<string>("")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<FeeRecord | undefined>(undefined)
  const [banner, setBanner] = useState<{ type: "success" | "error"; msg: string } | null>(null)

  const showBanner = (type: "success" | "error", msg: string) => {
    setBanner({ type, msg })
    setTimeout(() => setBanner(null), 3500)
  }

  // All active students for the picker
  const allStudents = useLiveQuery(
    () => db.students
      .where("deleted").equals(0)
      .filter(s => s.status === "active")
      .sortBy("first_name"),
    []
  )

  // Fee records for selected student — explicit return type avoids TS union inference issue
  const feeRecords = useLiveQuery<FeeRecord[]>(
    () => {
      if (!selectedStudentId) return Promise.resolve([] as FeeRecord[])
      return db.fee_records
        .where("student_id").equals(selectedStudentId)
        .filter(r => !r.deleted)
        .toArray()
    },
    [selectedStudentId]
  )

  const sortedRecords = useMemo(() => {
    if (!feeRecords) return []
    return [...feeRecords].sort((a, b) => {
      // Sort: most recent due date first, nulls last
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return b.due_date.localeCompare(a.due_date)
    })
  }, [feeRecords])

  const selectedStudent = useMemo(
    () => allStudents?.find(s => s.id === selectedStudentId),
    [allStudents, selectedStudentId]
  )

  const handleAddFee = () => {
    setEditingRecord(undefined)
    setIsFormOpen(true)
  }

  const handleEditFee = (record: FeeRecord) => {
    setEditingRecord(record)
    setIsFormOpen(true)
  }

  const handleDeleteFee = async (record: FeeRecord) => {
    if (!ownerId) return
    if (!window.confirm("Delete this fee record?")) return
    try {
      await deleteFee(record.id, ownerId)
      showBanner("success", "Fee record deleted")
    } catch (err: any) {
      showBanner("error", err.message || "Failed to delete fee record")
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-6 lg:p-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Fees</h1>
        {selectedStudentId && (
          <button
            onClick={handleAddFee}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Fee</span>
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
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center animate-in fade-in-50">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <IndianRupee className="size-6 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Select a student</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-[240px]">
            Choose a student above to view or record their fees.
          </p>
        </div>
      )}

      {/* ── Student selected ── */}
      {selectedStudentId && selectedStudent && (
        <div className="flex flex-col gap-4">

          {/* Balance summary — uses computeStudentFeeStats internally */}
          <StudentBalanceSummary records={feeRecords || []} />

          {/* Fee list */}
          {sortedRecords.length > 0 ? (
            <div className="flex flex-col gap-2">
              {sortedRecords.map(record => (
                <FeeRow
                  key={record.id}
                  record={record}
                  onEdit={handleEditFee}
                  onDelete={handleDeleteFee}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={IndianRupee}
              title="No fee records"
              description="No fee records for this student yet."
              action={{ label: "Add first fee record", onClick: handleAddFee }}
            />
          )}
        </div>
      )}

      {/* ── Modal ── */}
      {selectedStudentId && (
        <FeeFormModal
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false)
            setEditingRecord(undefined)
          }}
          studentId={selectedStudentId}
          record={editingRecord}
          onSuccess={msg => showBanner("success", msg)}
        />
      )}
    </div>
  )
}
