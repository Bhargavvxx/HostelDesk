import { useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/local/db"
import { Student } from "@/local/types"
import { createStudentDocument, deleteStudentDocument } from "@/local/queries/student_documents"
import { useAuthStore } from "@/hooks/useAuthStore"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ImagePreview } from "@/components/common/ImagePreview"
import { Trash2, FilePlus2, Loader2 } from "lucide-react"

interface StudentDocumentsModalProps {
  isOpen: boolean
  onClose: () => void
  student?: Student
}

export function StudentDocumentsModal({ isOpen, onClose, student }: StudentDocumentsModalProps) {
  const { ownerId } = useAuthStore()
  
  const [docType, setDocType] = useState<"aadhar" | "id_proof" | "other">("aadhar")
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const documents = useLiveQuery(
    () => student ? db.student_documents.where({ student_id: student.id }).filter(d => !d.deleted).toArray() : [],
    [student?.id]
  )

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!student || !ownerId || !file) return

    setIsUploading(true)
    setError(null)

    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("File must be less than 5MB")
      if (!file.type.startsWith("image/")) throw new Error("File must be an image")

      await createStudentDocument({
        studentId: student.id,
        documentType: docType,
        fileBlob: file,
        mimeType: file.type
      }, ownerId)
      
      setFile(null)
    } catch (err: any) {
      setError(err.message || "Failed to upload document")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!ownerId || !window.confirm("Delete this document?")) return
    try {
      await deleteStudentDocument(id, ownerId)
    } catch (err: any) {
      alert(err.message || "Failed to delete document")
    }
  }

  if (!student) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Documents - {student.first_name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-2">
          
          {/* Upload Form */}
          <form onSubmit={handleUpload} className="rounded-lg border border-border bg-muted/50 p-4">
            <h4 className="text-sm font-semibold mb-3">Add New Document</h4>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="space-y-2 w-full sm:w-auto flex-1">
                <Label>Document Type</Label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value="aadhar">Aadhar Card</option>
                  <option value="id_proof">ID Proof</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2 w-full sm:w-auto flex-[2]">
                <Label>File (Image)</Label>
                <Input 
                  type="file" 
                  accept="image/jpeg, image/png, image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="bg-background cursor-pointer"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={!file || isUploading}
                className="flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 w-full sm:w-auto"
              >
                {isUploading ? <Loader2 className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />}
                Upload
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </form>

          {/* Document List */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Existing Documents</h4>
            {!documents?.length ? (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {documents.map(doc => (
                  <div key={doc.id} className="relative group overflow-hidden rounded-lg border border-border bg-card">
                    <div className="aspect-[4/3] bg-muted relative">
                      <ImagePreview 
                        localBlobId={doc.local_file_blob_id}
                        cloudPath={doc.file_path}
                        className="size-full"
                        fallback={<div className="flex size-full items-center justify-center text-xs text-muted-foreground">Pending Sync</div>}
                      />
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="absolute top-2 right-2 rounded-md bg-background/80 p-1.5 text-destructive opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 hover:bg-background"
                        title="Delete"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="p-2 text-xs font-medium uppercase tracking-wider text-muted-foreground bg-muted/30 border-t border-border">
                      {doc.document_type.replace("_", " ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
