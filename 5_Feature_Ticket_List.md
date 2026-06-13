# Feature Ticket List — v7
## HostelDesk — Local-First Hostel Management App (Offline + Cloud Sync)

**Author:** Engineering Lead
**Version:** 7.0 (Correctness-Hardened)
**Last Updated:** June 2026

> Each ticket is written so it can be pasted directly into an AI coding tool (e.g. Google Antigravity — see AGENTS.md). Priorities: **Must-have (launch)**, **Should-have**, **Nice-to-have**. **Build the sync foundation (TICKET-01–06) before any feature screen** — if sync is broken, every later feature is unreliable.
>
> **v6 clarifications baked into tickets:** image fields (cloud `*_path` vs local `*_blob_id`), explicit student-level overdue formula, and offline duplicate-movement conflict handling (`conflict` outbox status + manual resolution).

---

### TICKET-01 — PWA & Design Foundation
**Priority:** Must-have
**Description:** Scaffold Vite + React + TypeScript + Tailwind + shadcn/ui + lucide-react. Add vite-plugin-pwa (manifest + service worker) so the app installs to the home screen and launches offline. Configure design tokens (palette, spacing, radius, shadows, Inter, tabular numbers) and light/dark themes. Build the app shell (mobile bottom tabs + desktop sidebar + sync-indicator slot).
**Acceptance criteria:**
- Runs with `npm run dev`; builds to an installable PWA.
- Installs to home screen; **loads with the network fully off**.
- shadcn/ui base components render per the Frontend Spec; theme toggle persists.
**Dependencies:** None.

---

### TICKET-02 — Local Database (Dexie)
**Priority:** Must-have
**Description:** Set up **Dexie** over IndexedDB with: synced tables (`students`, `student_documents`, `rooms`, `fee_records`, `attendance`, `movement_logs`) each with sync columns (`id` device-UUID, `updated_at`, `deleted`, `owner_id`, and `status` where applicable); and **local-only** tables (`outbox`, `file_blobs`, `sync_state`) exactly as defined in the Technical Architecture Document. Add the `fee_records.due_date` field. **Image fields:** synced tables store cloud paths only (`students.photo_path`, `student_documents.file_path`); local-only Dexie companion fields (`local_photo_blob_id`, `local_blob_id`) reference `file_blobs` and are NEVER sent to Postgres. The `outbox.status` enum includes **`conflict`**. **Use Dexie's versioned schema (`.version(n).stores(...)` with `.upgrade()` migrations) so future schema changes migrate existing rows and never drop stores / wipe data.** Request persistent storage.
**Acceptance criteria:**
- All synced and local-only tables exist with correct fields/indexes.
- `outbox` (with `conflict` status), `file_blobs`, `sync_state` are present and clearly local-only.
- Image references: cloud `*_path` on synced tables; local `*_blob_id` only in Dexie.
- `fee_records` includes `due_date`.
- Dexie schema is versioned; a simulated version bump migrates existing rows without data loss.
- Data survives restart; `navigator.storage.persist()` requested (warn if denied).
**Dependencies:** TICKET-01.

---

### TICKET-03 — Cloud Backend & Schema (Supabase)
**Priority:** Must-have
**Description:** Provide Supabase migration SQL mirroring the **synced** tables (with `owner_id`, `updated_at`, `deleted`, and `status` where applicable) plus row-level security policies scoped to `owner_id`, plus a private storage bucket. **Add the movement integrity rule**: a partial unique index `UNIQUE (student_id) WHERE check_in_time IS NULL AND deleted = false`. Add `fee_records.due_date`. Provide setup instructions; **do not assume the agent can create the user's Supabase account** — the user creates the project and applies migrations.
**Acceptance criteria:**
- Migration SQL + `policies.sql` provided; applies cleanly to a fresh project.
- RLS verified: a user can't read another user's rows; anon gets nothing.
- Partial unique index enforces one open movement per student.
- Do NOT create local-only tables (`outbox`/`file_blobs`/`sync_state`) in Postgres.
**Dependencies:** None (parallel to 01/02).

---

### TICKET-04 — Cloud Auth + Local App Lock
**Priority:** Must-have
**Description:** Supabase email+password login (once per device) + a local PIN/biometric app lock with idle auto-lock. Disable public sign-ups. Store only a PIN hash in Dexie.
**Acceptance criteria:**
- New device: login required once; session persists.
- Daily open: PIN/biometric unlocks; wrong PIN stays locked with a delay.
- Idle auto-lock works; public sign-ups disabled.
**Dependencies:** TICKET-01, TICKET-03.

---

### TICKET-05 — Sync Engine (Outbox + Pull + File Queue)
**Priority:** Must-have
**Description:** Build the sync engine on the `outbox`. Local writes append outbox items (`insert`/`update`/`delete`/`file_upload`). **Process the outbox FIFO and parent-before-child** (a `student` insert pushes before any `fee_records`/`attendance`/`movement_logs` referencing it; a child waits if its parent hasn't synced). When online: push `pending`/`failed` items to Supabase (updating `status`, `attempts`, `last_error`), then pull rows changed since `last_pulled_at` per table into Dexie, applying **last-write-wins** by `updated_at`. **`updated_at` is cloud-authoritative — the server sets it on push and that value overwrites the local one; a wrong device clock must never win a conflict.** Handle the **file queue**: upload `file_blobs` (status `local_only`→`uploading`→`synced`/`failed`) to Storage, then set the owning row's cloud `*_path`; pull/cache images via signed URLs. **Duplicate-movement conflict:** if the cloud rejects an open movement because one already exists (partial unique index), set that outbox item to **`conflict`**, keep it and its local row visible, and do NOT auto-resolve — surface it for the user. Handle offline→online transitions and batching; log overwritten versions.
**Acceptance criteria:**
- A change made offline appears in the cloud after reconnect; cloud/other-device changes pull into Dexie.
- **Outbox processes in creation order, parents before children; an offline-created student + fee sync without foreign-key errors.**
- **`updated_at` after sync reflects the server timestamp; a device with a deliberately wrong clock does not overwrite newer correct data.**
- Conflicts resolve by newest `updated_at`; **soft-deletes propagate (no zombie rows)** and are distinct from archive.
- **A duplicate open-movement rejected by the cloud becomes a `conflict` item, stays visible, and is never silently dropped.**
- Images queue offline and upload on reconnect; the cloud `*_path` is set on success; other device fetches via signed URL.
- New-device first run pulls all data to build the cache.
- Failed items remain in the outbox and retry; nothing is dropped.
**Dependencies:** TICKET-02, TICKET-03, TICKET-04.

---

### TICKET-06 — Sync Status Indicator & First-Run Setup
**Priority:** Must-have
**Description:** Header/dashboard sync pill (Synced / Syncing / Pending count / Offline) with last-sync time and a "Sync now" action. Add the one-time "Setting up — downloading your data…" screen on a new device.
**Acceptance criteria:**
- Indicator reflects real sync state and updates live.
- "Sync now" triggers a manual sync.
- New device shows setup until the initial pull completes.
**Dependencies:** TICKET-05.

---

### TICKET-07 — Room Management
**Priority:** Must-have
**Description:** Rooms screen + Dexie/cloud ops to create, edit, list rooms (number, capacity, notes, `status`) with live occupancy (active, non-deleted students). Prevent assigning beyond capacity.
**Acceptance criteria:**
- Create/edit/list rooms; occupancy shows current/capacity.
- Full rooms blocked from assignment; changes sync.
**Dependencies:** TICKET-05.

---

### TICKET-08 — Student Records, Images & Archive
**Priority:** Must-have
**Description:** Student CRUD with documented fields, optional photo, and ID/admission image upload (written to `file_blobs` with a local `*_blob_id`, queued via `file_upload`, the cloud `photo_path`/`file_path` set on upload, viewed via signed URLs; works offline). **Archive (`status='archived'`) for students who leave — never `deleted=true`.** Validate name/phone; room assignment respects capacity and updates occupancy.
**Acceptance criteria:**
- Add/edit/view/**archive** a student; archived students hidden from default list but retained with full history.
- A genuine removal uses the `deleted` soft-delete and syncs; leaving the hostel uses archive.
- Images upload when online, queue when offline, and display from local cache offline.
- Reassignment fixes both rooms' occupancy.
**Dependencies:** TICKET-07.

---

### TICKET-09 — Student List, Search & Filter
**Priority:** Must-have
**Description:** Student list with real-time search (name) and filters (room, dues status). Cards show photo, name, room, dues/overdue pill. Friendly empty state. Reads from Dexie (instant, offline).
**Acceptance criteria:**
- Search/filter work instantly offline; combine correctly.
- Empty database shows "Add your first student" CTA.
**Dependencies:** TICKET-08.

---

### TICKET-10 — Fee Management & Dues (with Due Date)
**Priority:** Must-have
**Description:** Fees screen to record payments (amount due/paid, period, **due_date**, payment date, method) and auto-calculate `student_balance = SUM(amount_due) − SUM(amount_paid)`. **Overdue is computed from the past-due portion only:** `overdue_balance = SUM(amount_due where due_date < today) − SUM(all amount_paid)`; the student is overdue when `overdue_balance > 0`. Never per-row, never guessed. Support partial and advance payments; Danger overdue pill; tabular numbers; balance summary. Offline + syncs.
**Acceptance criteria:**
- Recording a payment updates `student_balance` instantly (offline too).
- Overdue flag driven strictly by `overdue_balance > 0`; no past-due dues → not overdue, even if future dues exist.
- Partial/advance handled; invalid amounts rejected.
**Dependencies:** TICKET-08.

---

### TICKET-11 — Daily Attendance (with Overnight-Leave Default)
**Priority:** Must-have
**Description:** Attendance screen with date picker and a roll toggling present/absent/leave, saved per day (unique per student/day, overwrite not duplicate). Exclude pre-admission dates. **If a student has an open overnight/home-visit movement covering the date, pre-select `leave` as a suggestion the warden can override — never auto-write absent from movement data.** **The "date" is the IST calendar day (store UTC, compute in IST); an overnight leave crossing midnight covers both days.** Offline + syncs; toast on save.
**Acceptance criteria:**
- Mark/save offline; re-open shows existing values; no duplicates.
- Pre-admission dates excluded.
- Open overnight/home-visit pre-fills `leave`, overridable.
- Day boundaries use IST; an overnight leave crossing midnight pre-fills `leave` for both dates.
**Dependencies:** TICKET-08, TICKET-12.

---

### TICKET-12 — Smart Movement System (One Open Log)
**Priority:** Must-have
**Description:** Movement screen supporting casual exit / overnight leave / home visit, each with check-out time, optional purpose, and (required for overnight/home-visit) expected return. Live "Out now" + "Overdue to return." **Enforce one open movement log per student** in app logic (and rely on the DB partial unique index). **Handle the offline duplicate case:** if two devices were offline and both checked the same student out, the cloud rejects one on sync — show a **conflict banner** with "keep this / keep the other" so the user resolves it; never auto-drop a gate event. Disable check-in unless out; allow closing a forgotten-open log. Offline + syncs.
**Acceptance criteria:**
- Check-out records type + expected return and adds to "Out now"; a **second check-out on the same device is blocked** with a clear message.
- A **cross-device offline duplicate** surfaces as a resolvable conflict, not a silent drop.
- Check-in records return time and removes from the list.
- "Overdue to return" lists anyone past expected return; overnight logs spanning days behave correctly.
- Works offline and syncs.
**Dependencies:** TICKET-08.

---

### TICKET-13 — Dashboard with Reminders
**Priority:** Must-have
**Description:** Dashboard home with 5 stat tiles (present today, out now, overdue returns, total dues, free beds), an "out now / overdue" list, a reminders strip (overdue fees by due_date + late returns), the sync indicator with last-sync, and last-Drive-backup status. All derived from Dexie; instant offline.
**Acceptance criteria:**
- Stats accurate and live; update after relevant actions.
- Reminders surface overdue fees (by `overdue_balance > 0`) and overdue returns.
- Sync + last-backup status visible.
**Dependencies:** TICKET-06, TICKET-10, TICKET-11, TICKET-12.

---

### TICKET-14 — Global Error Handling, Toasts & Empty States
**Priority:** Must-have
**Description:** Consistent handling per the Security Doc: clear human messages; "Saved — will sync when online" for offline writes; retry-on-reconnect for failed outbox items; confirmation dialogs for archive/destructive actions; success toasts; friendly empty states. Never lose data on a failed save/sync/upload.
**Acceptance criteria:**
- Offline actions save locally and queue; failures retry, never drop data.
- Archive/destructive actions confirm; success shows a toast; no blank crashes.
**Dependencies:** TICKET-05 through TICKET-13.

---

### TICKET-15 — Local Backup & CSV/Excel Export
**Priority:** Should-have
**Description:** Backup screen with CSV export (papaparse) and Excel export (SheetJS, one sheet per table), plus a full JSON export/import (all tables + Base64 images) as a safety net. Show last-sync/last-backup status.
**Acceptance criteria:**
- CSV and Excel exports produce accurate, readable files.
- Full JSON export/import round-trips data; import validates and confirms before replacing.
**Dependencies:** TICKET-08, TICKET-10, TICKET-11.

---

### TICKET-16 — Backup to Google Drive (Excel + JSON)
**Priority:** Should-have
**Description:** Add "Backup to Google Drive" that writes two timestamped files to a dedicated Drive folder: `HostelDesk_backup_YYYY-MM-DD.xlsx` (sheets per table) and `…json` (full backup incl. Base64 images). Handle Drive authorization at runtime; show "Last Drive backup" and a recent-backups list. Failure must leave local + cloud data intact.
**Acceptance criteria:**
- One tap saves both files to the user's Drive.
- Excel is browsable (sheets per table); JSON restores fully.
- Drive auth/upload failures show a clear message; no data loss.
**Dependencies:** TICKET-15.

---

### TICKET-17 — Conflict & Sync Hardening
**Priority:** Should-have
**Description:** Stress-test sync: large offline outboxes, simultaneous edits on two devices, interrupted syncs, file-queue failures, and clock skew. **Verify the offline duplicate-movement conflict path end-to-end** (both devices offline → both check the same student out → one becomes `conflict` on sync → user resolves it). Add a small "recently overwritten" log the user can review. Verify archive vs soft-delete never conflate.
**Acceptance criteria:**
- Large queues sync in batches with progress.
- Two-device edits resolve by last-write-wins with overwritten versions logged.
- **Duplicate open-movement conflicts are flagged, surfaced, and resolvable — never silently dropped or auto-merged.**
- Interrupted syncs resume without duplication/loss; images recover.
- Archived students are never treated as deleted and vice versa.
**Dependencies:** TICKET-05.

---

### TICKET-18 — Dark Mode Polish & Accessibility
**Priority:** Nice-to-have
**Description:** Finalize dark theme across all screens, ensure colour contrast meets accessibility, respect reduce-motion, verify large tap targets.
**Acceptance criteria:**
- Every screen correct in light/dark; contrast passes; motion respects settings.
**Dependencies:** TICKET-01 + all screens.

---

## Build Order Summary
1. **Foundation (do first, single-threaded):** 01, 02, 03 (parallel) → 04
2. **Sync core (must work before features):** 05 → 06
3. **Data & operations:** 07 → 08 → 09; then 10, 12, 11 (note 11 depends on 12), and 13
4. **Surface & trust:** 14
5. **Should-have:** 15 → 16, plus 17
6. **Nice-to-have:** 18
