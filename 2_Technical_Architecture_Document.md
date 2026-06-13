# Technical Architecture Document — v7
## HostelDesk — Local-First Hostel Management App (Offline + Cloud Sync)

**Author:** Software Architecture
**Version:** 7.0 (Correctness-Hardened)
**Last Updated:** June 2026

> **What changed from v6 (correctness safeguards — no architecture change):**
> 1. **Dexie schema versioning** (§4.2) — local schema upgrades use Dexie's versioned migrations; never wipe data on a version bump.
> 2. **Cloud-authoritative `updated_at`** (§5) — the cloud stamps `updated_at` on push; the device clock is only a fallback for offline ordering, so a wrong phone clock can't clobber good data.
> 3. **Day-boundary rule** (§4.3) — attendance/movement "day" is the IST calendar day; defined to remove midnight ambiguity.
> 4. **FIFO + dependency-ordered outbox** (§5) — outbox items sync in creation order, parents before children (student before that student's fee), so offline-created relationships don't fail on sync.
>
> **Carried over from v6/v5:** image fields disambiguated (cloud `*_path` vs local `local_*_blob_id`); student-level overdue formula; offline duplicate-movement conflict handling; Dexie local DB; `outbox`/`file_blobs`/`sync_state` local-only; `due_date` on fees; archive vs delete separated; one-open-movement rule (app + Postgres partial unique index); optional Google Drive backup (Excel + JSON).

---

## 1. Guiding Principles

Local-first, single-user, installable on phone and laptop. The UI reads/writes the local Dexie cache first (instant, offline-capable); a background sync engine reconciles with Supabase when online. The cloud is the durable source of truth and backup; Google Drive is an optional extra backup. Conflicts are rare (one editor) and resolved by **last-write-wins** via `updated_at`. Simplicity over cleverness.

---

## 2. Recommended Tech Stack

| Layer | Choice | Reasoning |
|---|---|---|
| App type | **PWA (installable, offline shell)** | Home-screen install on phone + laptop; launches offline. |
| Framework | **Vite + React + TypeScript** | Fast static build that runs offline; TS for safety. |
| Styling | **Tailwind CSS + shadcn/ui** | Polished, accessible components without bespoke CSS. |
| Icons | **lucide-react** | Clean, consistent icons. |
| **Local database** | **Dexie.js (IndexedDB wrapper)** | **Chosen.** Browser-native, simple, ideal for PWA/offline/outbox patterns, and far less error-prone for an AI coding agent than SQLite-WASM. Holds the cache, outbox, and file blobs. |
| Cloud backend | **Supabase (Postgres + Auth + Storage)** | Managed source of truth, login for sync, file storage; generous free tier. |
| Cloud auth | **Supabase Auth (email + password)** | One login per device enables sync + backup. |
| Sync engine | **Custom outbox + pull-changes** | Local writes append to `outbox`; a worker pushes to Supabase when online and pulls remote changes since last sync. Simple and debuggable. |
| Offline shell | **vite-plugin-pwa (Workbox)** | Precaches the app; install prompt; offline support. |
| Data/state | **TanStack Query + Zustand** | Query caches local reads; Zustand holds sync/UI state. |
| Image handling | **Supabase Storage (cloud) + Dexie `file_blobs` (local)** | Images live in the cloud; cached/queued locally for offline. |
| Drive backup (optional) | **Google Drive (via MCP/Drive API)** | Saves Excel (`xlsx`/SheetJS) + JSON backups to your Drive. |
| CSV / Excel export | **papaparse (CSV), SheetJS/xlsx (Excel)** | On-device, no external paid service. |
| App lock | **PIN hashed in Dexie + optional WebAuthn/biometric** | Local lock on top of the cloud login. |
| Hosting (install source) | **Vercel / Netlify** | Serves the PWA; app runs offline after install. |

---

## 3. File & Folder Structure

```
hosteldesk/
├── public/
│   ├── manifest.webmanifest
│   └── icons/
├── src/
│   ├── main.tsx
│   ├── App.tsx                     # Routes + app-lock gate
│   ├── routes/
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx               # Cloud login (per device)
│   │   ├── Lock.tsx                # Local PIN/biometric
│   │   ├── students/ { StudentList, StudentForm, StudentDetail }.tsx
│   │   ├── Fees.tsx
│   │   ├── Attendance.tsx
│   │   ├── Movement.tsx
│   │   ├── Rooms.tsx
│   │   └── Backup.tsx              # CSV + JSON + Drive backup
│   ├── cloud/
│   │   ├── supabase.ts
│   │   └── auth.ts
│   ├── local/
│   │   ├── db.ts                   # Dexie database definition
│   │   ├── schema.ts               # Dexie tables + indexes
│   │   └── queries/                # students.ts, fees.ts, movement.ts, ...
│   ├── sync/
│   │   ├── outbox.ts               # Enqueue/read/clear outbox items
│   │   ├── engine.ts               # Push pending + pull remote (last-write-wins)
│   │   ├── files.ts                # Upload queued blobs, cache downloads
│   │   ├── status.ts               # synced / syncing / pending / offline
│   │   └── conflicts.ts            # updated_at comparison rules
│   ├── backup/
│   │   ├── exportExcel.ts          # SheetJS workbook builder
│   │   ├── exportJson.ts           # Full backup incl. Base64 images
│   │   └── drive.ts                # Save files to Google Drive
│   ├── lib/
│   │   ├── lock.ts                 # PIN hash, biometric, idle auto-lock
│   │   ├── images.ts               # Compress, store/read blobs
│   │   └── utils.ts                # ₹ + DD/MM/YYYY formatters
│   ├── components/ { ui/, layout/ }
│   ├── hooks/
│   └── types/
├── supabase/
│   ├── migrations/                 # Cloud schema SQL (you apply these)
│   └── policies.sql                # Row-level security
├── vite.config.ts
├── tailwind.config.ts
├── package.json
├── AGENTS.md
└── README.md
```

---

## 4. Database Schema (Plain English)

There are **two synced tables sets**: the cloud Postgres (source of truth) and the local Dexie mirror. Plus **local-only** tables (`outbox`, `file_blobs`, `sync_state`) that never leave the device.

**Sync columns on every *synced* table:** **id** (device-generated UUID so offline rows have stable IDs), **updated_at** (timestamp for last-write-wins), **deleted** (boolean; sync-level soft delete), **owner_id** (your account).

> **Archive vs delete — important distinction:**
> - **`status = 'archived'`** (on students/rooms): the entity is no longer active (e.g. a student left the hostel) but its history is intentionally **kept and visible**. This is a normal business state.
> - **`deleted = true`** (sync flag on every table): the row was **intentionally removed** and this removal must propagate to other devices. Used for genuine mistakes/cleanups, not for students leaving.
> A student leaving the hostel → set `status='archived'`, **never** `deleted=true`.

### Synced tables

**`students`** — id, full_name, phone, guardian_name, guardian_phone, address, room_id (nullable), admission_date, **photo_path** (nullable; **cloud** storage path — the synced reference), **status** (`active`/`archived`) + sync columns.
*Local-only companion field (Dexie only, NOT in Postgres): **local_photo_blob_id** — points to a `file_blobs` row while the image is still local/queued. Cleared/ignored once `photo_path` is set.*

**`student_documents`** — id, student_id, doc_type (`id_proof`/`admission_form`/`other`), **file_path** (nullable; **cloud** storage path — the synced reference), uploaded_at + sync columns.
*Local-only companion field (Dexie only, NOT in Postgres): **local_blob_id** — points to a `file_blobs` row until the upload completes.*

**`rooms`** — id, room_number, capacity, notes, status (`active`/`archived`) + sync columns. Occupancy = count of active, non-deleted students with this room_id.

**`fee_records`** — id, student_id, amount_due, amount_paid, period_label, **due_date** (when the fee is due), payment_date (nullable; when paid), method (`cash`/`upi`/`bank`), notes + sync columns.

**Overdue — exact, student-level definition (do not compute per-row):**
```
student_balance      = SUM(amount_due over ALL rows) − SUM(amount_paid over ALL rows)
overdue_balance      = SUM(amount_due where due_date < today) − SUM(amount_paid over ALL rows)
student is OVERDUE    when overdue_balance > 0
```
*Assumption (state it; don't invent allocation): payments are not tagged to specific fee rows in this simple model, so all payments are applied against the oldest dues first — i.e. paid amounts offset the past-due total before any future dues. `student_balance` drives "total dues"; `overdue_balance` drives the overdue flag. A student with future-dated dues but everything past-due paid is **not** overdue.* Partial and advance payments supported.

**`attendance`** — id, student_id, date, status (`present`/`absent`/`leave`) + sync columns. Unique (student_id, date). Pre-admission dates excluded.
*Default rule: if the student has an **open** overnight/home_visit movement covering this date, pre-select `leave` (the warden can override). Never auto-write absent from movement data.*

**`movement_logs`** — id, student_id, type (`casual`/`overnight`/`home_visit`), check_out_time, expected_return (nullable; **required** for overnight/home_visit), check_in_time (nullable while out), purpose (optional) + sync columns.
*"Out now" = check_in_time empty AND not deleted. "Overdue" = out now AND now > expected_return.*
***Rule: a student may have only ONE open movement log at a time.*** Enforce in app logic AND in Postgres with a partial unique index: `UNIQUE (student_id) WHERE check_in_time IS NULL AND deleted = false`.

### Local-only tables (NEVER synced)

**`outbox`** — the sync queue. Fields:
- **id** (local autoincrement)
- **table_name** (which synced table the change belongs to)
- **row_id** (the UUID of the affected row)
- **operation** (`insert` / `update` / `delete` / `file_upload`)
- **payload_json** (the change to apply in the cloud)
- **status** (`pending` / `syncing` / `failed` / `conflict` / `done`)
- **attempts** (retry count)
- **last_error** (text, for debugging)
- **created_at**, **updated_at**

Every local write appends an outbox row. The sync engine processes `pending`/`failed` items when online.

**`file_blobs`** — local home for images before/after upload. Fields:
- **id** (UUID, referenced by students/documents)
- **owner_id**
- **blob** (the actual image bytes, stored in IndexedDB)
- **cloud_path** (nullable until uploaded)
- **mime_type**, **size_bytes**
- **status** (`local_only` / `uploading` / `synced` / `failed`)
- **created_at**, **updated_at**

Images are written here first; a `file_upload` outbox item triggers upload to Supabase Storage; on success, the owning row's **cloud `*_path`** is set, the local `*_blob_id` is no longer needed, and status becomes `synced`. **The `file_blobs` id is referenced only by local-only Dexie fields (`local_photo_blob_id`, `local_blob_id`) — never written to Postgres.**

**`sync_state`** — bookkeeping: **last_pulled_at** per synced table (so pulls only fetch new changes). Plus app-lock PIN hash and last-sync/last-backup timestamps.

> **Reminders** are derived at runtime (overdue fees by due_date + overdue returns), not stored.

---

### 4.2 Local schema versioning (Dexie) — never wipe data on upgrade

Dexie supports **versioned schema upgrades**. When the app ships a new local schema (e.g. a new field), bump the Dexie version and provide an upgrade function that migrates existing rows — do **not** drop and recreate stores, which would erase the user's offline data.

Rules:
- Each schema change increments the Dexie DB version with a `.version(n).stores(...)` definition and, where data shape changes, an `.upgrade()` migration that transforms existing records.
- Migrations are **additive and non-destructive** by default (add fields/indexes; backfill defaults). Never delete a store as part of a routine upgrade.
- Keep the Dexie version history in `src/local/schema.ts` so upgrades are reproducible.
- A local schema change that affects synced columns must ship **together** with the matching Supabase migration so local and cloud stay compatible (a mismatch breaks sync).

### 4.3 Day-boundary rule (IST) for attendance & movement

To remove midnight ambiguity, the "day" for attendance and movement is the **IST calendar day**:
- Timestamps are stored in **UTC** and converted to **IST (UTC+5:30)** for any day-based logic and display.
- **Attendance** `date` is the IST date the warden is marking.
- A **movement** event's effect on attendance uses the IST date of its `check_out_time` / coverage window. An overnight leave that opens at 23:30 IST on the 5th and closes at 07:00 IST on the 6th covers **both** the 5th and the 6th for the leave default.
- "Overdue to return" compares `now` to `expected_return`, both in UTC internally — the IST conversion is only for what the warden sees.

---

## 5. How Sync Works (Plain English)

1. **Every change writes to Dexie first** and appends an **`outbox`** item. The UI updates instantly — never waits on the network.
2. **Outbox is processed FIFO and dependency-ordered.** Items sync in the order they were created, and **parents sync before children** — a `student` insert is pushed before any `fee_records`/`attendance`/`movement_logs` that reference it, so an offline-created relationship never fails a foreign-key check on the cloud. If a child's parent hasn't synced yet (or its push failed), the child waits rather than erroring.
3. **When online**, the sync engine:
   - **Pushes** `pending`/`failed` outbox items to Supabase (insert/update/soft-delete/file_upload), marking each `done`, `failed`, or `conflict` (with `last_error` + incremented `attempts`).
   - **Pulls** rows from Supabase changed since `last_pulled_at` per table and updates Dexie.
4. **`updated_at` is cloud-authoritative.** On push, the **cloud** sets each row's `updated_at` (the server timestamp is the source of truth). The device-set timestamp is only a **fallback for ordering changes made while offline** and is overwritten by the server value once synced. This means a device with a wrong clock cannot win a conflict and clobber correct data.
5. **Conflict rule:** same row changed in both places → newer (cloud) `updated_at` wins. Rare for one user; the overwritten version is logged.
6. **Duplicate-movement conflict (special case):** the Postgres partial unique index forbids two open movement logs for one student. If two devices were offline and both checked the same student out, the cloud will **reject the second** on sync. The engine must NOT silently drop it: mark that outbox item **`conflict`**, keep it visible (e.g. "Two check-outs for Student A — keep which one?"), and let the user resolve it manually. The losing local open-log is not deleted automatically — the user decides. This is the one place last-write-wins is deliberately overridden, because a gate event shouldn't vanish on its own.
7. **Deletes** are soft (`deleted=true`) so they propagate instead of reappearing. (Distinct from `status='archived'`.)
8. **Images:** stored in `file_blobs` (status `local_only`), referenced locally via `local_*_blob_id` → a `file_upload` outbox item uploads to Supabase Storage when online → sets the blob's `cloud_path` and the synced row's `*_path`, status `synced`. Other devices pull the `*_path` and fetch via signed URL, caching the blob locally.
9. **Status indicator:** synced / syncing / pending(N) / **conflict** / offline.

This is the **outbox + pull-changes** pattern — the simplest reliable sync for one user across two devices.

---

## 6. Google Drive Backup (Optional, Should-Have)

A third safety layer on top of local + cloud. The **Backup** screen offers "Backup to Google Drive," which writes two files into a dedicated Drive folder:

- **`HostelDesk_backup_YYYY-MM-DD.xlsx`** — one sheet per table (Students, Fees, Attendance, Movement, Rooms) via SheetJS. Human-readable; openable in Google Sheets; printable. *Images are not embedded in Excel.*
- **`HostelDesk_backup_YYYY-MM-DD.json`** — full backup (all tables + Base64-encoded images) for complete restore on any device.

The dashboard shows "Last Drive backup: …". Manual in v1; a scheduled auto-backup is a should-have. The JSON is the restore artifact; the Excel is for browsing/records.

---

## 7. Environment Variables & Configuration Notes

```env
# Supabase (anon key is safe to expose; protected by row-level security)
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_STORAGE_BUCKET=hosteldesk-files

# App
VITE_APP_NAME=HostelDesk
```

(No secret keys in the client. Google Drive access is granted at runtime via the user's Drive authorization, not a stored key.)

**Before you build:**
- **Row-level security is mandatory** in the cloud: every row carries `owner_id`; policies allow access only where `owner_id` = the logged-in user.
- **Device-generated UUIDs** for synced rows so offline-created records don't collide.
- **`outbox`, `file_blobs`, `sync_state` are local-only** — do not create them in Postgres or sync them.
- **Dexie schema upgrades are versioned and non-destructive** (§4.2) — never drop a store on a version bump; migrate existing rows.
- **`updated_at` is cloud-authoritative** (§5) — the server stamps it on push; never let a device clock decide a conflict.
- **Outbox is FIFO + dependency-ordered** (§5) — parents before children; a child waits if its parent hasn't synced.
- **Day logic uses the IST calendar day** (§4.3) — store UTC, convert to IST for attendance/movement day boundaries.
- **Request persistent storage** (`navigator.storage.persist()`) so Dexie data isn't evicted.
- **Private storage bucket** + signed URLs for images; cache blobs locally.
- **Time zone (IST):** store UTC, display IST, so sync ordering, due dates, and attendance dates are consistent across devices.
- **Compress images** (~1 MB max) before storing/uploading.
- **App lock:** store only a PIN hash; add idle auto-lock.
- **Keep local Dexie schema and cloud SQL migrations in lockstep** — a mismatch breaks sync.
- **You create the Supabase project and apply migrations** (the coding agent provides the SQL and instructions; it does not manage your cloud account).
