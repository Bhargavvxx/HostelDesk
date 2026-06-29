import { useState, useRef } from "react"
import { Download, Upload, AlertTriangle, FileSpreadsheet, FileText } from "lucide-react"
import { Banner } from "@/components/common/Banner"
import { exportFullJSON, exportCSVs, exportExcel } from "@/local/queries/export"
import { restoreFromJSON } from "@/local/queries/import"
import { useNavigate } from "react-router"

export default function Backup() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isExporting, setIsExporting] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [banner, setBanner] = useState<{ type: "success" | "error" | "warning"; msg: string } | null>(null)

  const showBanner = (type: "success" | "error" | "warning", msg: string) => {
    setBanner({ type, msg })
    setTimeout(() => setBanner(null), 5000)
  }

  const handleExportCSV = async () => {
    try {
      setIsExporting(true)
      await exportCSVs()
      showBanner("success", "CSV export complete.")
    } catch (err: any) {
      showBanner("error", err.message || "Failed to export CSV.")
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportExcel = async () => {
    try {
      setIsExporting(true)
      await exportExcel()
      showBanner("success", "Excel export complete.")
    } catch (err: any) {
      showBanner("error", err.message || "Failed to export Excel.")
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportJSON = async () => {
    try {
      setIsExporting(true)
      await exportFullJSON()
      showBanner("success", "Full JSON backup downloaded.")
    } catch (err: any) {
      showBanner("error", err.message || "Failed to create JSON backup.")
    } finally {
      setIsExporting(false)
    }
  }

  const triggerRestore = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input so the same file can be selected again if needed
    e.target.value = ""

    const confirmed = window.confirm(
      "WARNING: Restoring from a backup will COMPLETELY REPLACE all current local data. " +
      "Are you absolutely sure you want to proceed?"
    )

    if (!confirmed) return

    try {
      setIsRestoring(true)
      const text = await file.text()
      const envelope = JSON.parse(text)
      
      await restoreFromJSON(envelope, async () => {
        // Create emergency backup
        await exportFullJSON()
      })

      showBanner("success", "Data restored successfully.")
      
      // Delay slightly and reload dashboard to ensure all stores re-hydrate
      setTimeout(() => {
        navigate("/")
      }, 1500)
      
    } catch (err: any) {
      console.error(err)
      showBanner("error", err.message || "Failed to restore backup.")
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-6 lg:p-8">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Backup & Export</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Export data for reporting or backup your local database.
        </p>
      </div>

      {/* ── Banner ── */}
      {banner && <Banner type={banner.type} message={banner.msg} />}

      {/* ── Privacy Warning ── */}
      <div className="rounded-lg bg-warning/10 border border-warning/20 p-4 text-sm text-warning-foreground flex gap-3">
        <AlertTriangle className="size-5 shrink-0" />
        <div>
          <p className="font-semibold mb-1">Privacy Warning</p>
          <p>
            Backups may contain private student data and images. Store them securely.
            Full JSON backups also include local settings and sync metadata.
          </p>
          <p className="mt-1">
            <strong>Note:</strong> JSON backups include local unsynced image blobs. Synced images are referenced by cloud storage paths and require Supabase Storage availability (they are not embedded in the JSON).
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:gap-8 mt-2">
        {/* ── Reporting Export ── */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Reporting Export</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Download human-readable reports of your domain tables (Students, Rooms, Fees, etc.).
            </p>
          </div>
          <div className="flex flex-col gap-3 mt-auto">
            <button
              onClick={handleExportExcel}
              disabled={isExporting || isRestoring}
              className="flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted disabled:opacity-50"
            >
              <FileSpreadsheet className="size-4 text-emerald-600" />
              Export as Excel (.xlsx)
            </button>
            <button
              onClick={handleExportCSV}
              disabled={isExporting || isRestoring}
              className="flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted disabled:opacity-50"
            >
              <FileText className="size-4 text-blue-600" />
              Export as CSV (Multiple files)
            </button>
          </div>
        </div>

        {/* ── Full Backup / Restore ── */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Full Database Snapshot</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Save or restore a complete snapshot of your entire local database (including images).
            </p>
          </div>
          <div className="flex flex-col gap-3 mt-auto">
            <button
              onClick={handleExportJSON}
              disabled={isExporting || isRestoring}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Download className="size-4" />
              Download Full Backup (.json)
            </button>
            
            <div className="relative pt-2">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-2 text-xs text-muted-foreground">RESTORE</span>
              </div>
            </div>

            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            
            <button
              onClick={triggerRestore}
              disabled={isExporting || isRestoring}
              className="flex items-center justify-center gap-2 rounded-lg border border-destructive bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
            >
              <Upload className="size-4" />
              {isRestoring ? "Restoring..." : "Restore from Backup"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
