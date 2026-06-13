# AGENTS.md — Build Instructions for Google Antigravity
## HostelDesk — Local-First Hostel Management App (Offline + Cloud Sync)

Read this file **first**, then the other five docs. Treat **v7 as the master spec**. Work ticket-by-ticket from `5_Feature_Ticket_List.md`. The PRD, Technical Architecture, Security & Access, and Frontend Spec are the source of truth for *what* and *how*.

---

## 1. Project Summary (Read First)

HostelDesk is a **single-user, local-first PWA** for managing one hostel. It must work **offline and online**, on **phone and laptop**, with data saved **locally (Dexie/IndexedDB) and in the cloud (Supabase)**, syncing automatically via an **outbox + pull-changes** pattern with **last-write-wins**. An optional **Google Drive backup** (Excel + JSON) is a third safety layer.

**Stack:** Vite + React + TypeScript, Tailwind + shadcn/ui, lucide-react, vite-plugin-pwa (Workbox), **Dexie** (local DB), Supabase (Postgres + Auth + Storage), TanStack Query + Zustand, SheetJS + papaparse (export).

---

## 2. Non-Negotiables (Common Failure Points — Get These Right)

1. **Local-first.** The UI **reads/writes Dexie first** and returns instantly. Supabase is background-only. **Never block an action on the network.**
2. **Use Dexie** for the local database — not SQLite-WASM, not raw IndexedDB. This is decided.
3. **The `outbox` table is the sync queue.** Every local write appends an outbox item (`insert`/`update`/`delete`/`file_upload`). Do not invent a different queue.
4. **Images: cloud stores paths, local stores blob refs.** Synced/cloud tables hold only `photo_path` / `file_path`. Images go through `file_blobs` (status `local_only`→`uploading`→`synced`/`failed`) referenced by **local-only** Dexie fields (`local_photo_blob_id`, `local_blob_id`) and a `file_upload` outbox item. **Never store a `file_blobs` reference in Postgres.** Do not upload directly from the UI.
5. **`outbox`, `file_blobs`, `sync_state` are LOCAL-ONLY.** Never create them in Postgres; never sync them.
6. **Device-generated UUIDs** for every synced row (so offline-created rows don't collide).
7. **Soft-delete (`deleted=true`) ≠ archive (`status='archived'`).** A student leaving the hostel is **archived** (history kept). `deleted` is only for genuine removals and propagates across devices. **Never hard-delete; never archive-by-deleting.**
8. **One open movement log per student.** Enforce in app logic AND via the Postgres partial unique index `UNIQUE (student_id) WHERE check_in_time IS NULL AND deleted = false`. Block a second check-out on the same device. **If two offline devices both check the same student out, the cloud rejects one on sync → set that outbox item to `conflict`, keep it visible, and let the user resolve it manually. Never auto-drop or auto-merge a gate event.**
9. **Overdue is real, not guessed, and computed at student level (not per-row):**
   `student_balance = SUM(amount_due) − SUM(amount_paid)` (drives "total dues");
   `overdue_balance = SUM(amount_due where due_date < today) − SUM(all amount_paid)`; the student is **overdue when `overdue_balance > 0`**. No past-due dues → not overdue even if future dues exist. Assume payments offset oldest dues first; do not invent payment-to-row allocation.
10. **Attendance is never auto-written from movement.** If an open overnight/home-visit covers a date, **pre-select `leave` as a suggestion** the warden can override.
11. **Cloud RLS scoped to `owner_id`.** Images are private (signed URLs only).
12. **`updated_at` is cloud-authoritative.** The server sets it on push and that value overwrites the local one. A wrong device clock must never win a conflict. The device timestamp is only a fallback for ordering offline changes.
13. **Outbox is FIFO + parent-before-child.** Sync items in creation order; push a `student` before any `fee`/`attendance`/`movement` that references it. A child waits if its parent hasn't synced — never let an offline-created relationship fail a foreign-key check.
14. **Dexie schema is versioned and non-destructive.** Use `.version(n).stores(...)` with `.upgrade()` migrations. Never drop a store or wipe the local DB on an app/schema update.
15. **Day logic uses the IST calendar day.** Store UTC; convert to IST for attendance/movement day boundaries. An overnight leave crossing midnight covers both IST days.

---

## 3. How to Work (Agent Workflow)

1. **Plan before coding.** For each ticket, restate the goal, list files to create/modify, then implement. Use the ticket's **acceptance criteria as the definition of done.**
2. **Build the foundation first, single-threaded:** TICKET-01 → 02 → 03 → 04 → 05 → 06. **Do not start any feature screen (students/fees/attendance/movement) until sync works.** If sync is broken, every later feature is unreliable.
3. **Respect dependencies** listed on each ticket.
4. **Self-verify in the browser.** After each ticket, run the app and exercise the feature **with the network both on and off** where relevant; confirm sync round-trips.
5. **Ask only when genuinely blocked.** Prefer the documented choice; if a doc is ambiguous, pick the simplest option consistent with "single-user, local-first, offline" and note the assumption.
6. **Never invent scope.** Removed features (complaints, visitor log, room history, mess fees, charts) stay out.

---

## 4. Supabase Setup — Who Does What

**The agent does NOT manage the user's cloud account.**
- **User:** creates the Supabase project, supplies `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and applies the migrations.
- **Agent:** produces the migration SQL (`supabase/migrations`), the RLS policies (`supabase/policies.sql`, including the movement partial unique index), and clear setup instructions. The agent applies them only if proper tooling/credentials are explicitly provided.

---

## 5. Suggested Sub-Agent Plan (After Foundation Only)

Build TICKET-01–06 single-threaded first (shared foundation). Then parallelize:
- **Agent A — Data & Sync:** owns `src/local/` (Dexie), `src/sync/` (outbox, engine, files), `supabase/`. **Freezes the local query interface in `src/local/queries/` before B/C build against it** — treat it as a contract.
- **Agent B — Operations screens:** Students, Fees, Attendance, Movement, Rooms (TICKET-07–12) via Agent A's query layer.
- **Agent C — Shell & polish:** Dashboard, nav, sync indicator, error handling, toasts, empty states, backup/Drive, dark mode (TICKET-13–18).

Run a background verification agent after each milestone: launch the app, toggle offline, confirm sync and the integrity rules (one-open-log, overdue-by-due-date, archive≠delete).

---

## 6. Guardrails (Must Not Do)

- ❌ Write straight to Supabase from the UI (always Dexie-first → outbox → sync).
- ❌ Use SQLite-WASM or raw IndexedDB instead of Dexie.
- ❌ Use auto-increment integer IDs for synced rows.
- ❌ Hard-delete, or archive a leaver by setting `deleted=true`.
- ❌ Sync or cloud-create the local-only tables (`outbox`/`file_blobs`/`sync_state`).
- ❌ Expose images via public URLs.
- ❌ Store the PIN in plain text.
- ❌ Allow a second open movement log for a student.
- ❌ Invent overdue logic without a `due_date`.
- ❌ Auto-write attendance from movement data.
- ❌ Let a device clock decide a conflict (server stamps `updated_at`).
- ❌ Push a child row before its parent (outbox is FIFO + parent-first).
- ❌ Drop a Dexie store / wipe local data on a schema upgrade.
- ❌ Add libraries beyond the documented stack without a clear reason.
- ❌ Assume the agent can create/manage the user's Supabase account.

---

## 7. Per-Ticket Verification Checklist

- [ ] All acceptance criteria pass.
- [ ] Works **offline** where implied; local changes **sync** and **pull back** on another session.
- [ ] Dexie used; outbox + file_blobs used correctly; local-only tables not synced.
- [ ] Device UUIDs; no integer IDs; no hard-deletes; archive≠delete respected.
- [ ] One-open-movement rule holds; overdue driven by due_date; attendance not auto-written.
- [ ] Images: queue offline, upload online, signed URLs only.
- [ ] Errors show clear messages; offline writes show "Saved — will sync when online."
- [ ] Lint/typecheck pass; app builds as an installable PWA and launches offline.
- [ ] Matches Frontend Spec tokens (colours, spacing, components).

---

## 8. Recommended First Prompt (for the user to give Antigravity)

```
Read AGENTS.md first, then all v7 docs. Treat v7 as the master spec.
Before coding, confirm you will:
- use Dexie as the local database, with versioned non-destructive schema upgrades
- implement the outbox as the sync queue, processed FIFO and parent-before-child
- implement the file_blobs queue for images (cloud stores *_path; local stores local_*_blob_id)
- keep outbox/file_blobs/sync_state local-only (never in Postgres)
- compute overdue at the student level: overdue_balance = SUM(amount_due where due_date<today) − SUM(all amount_paid); overdue when > 0
- enforce one open movement log per student (app + DB partial unique index), and surface cross-device offline duplicates as a manual conflict
- make updated_at cloud-authoritative (a wrong device clock must not win)
- use the IST calendar day for attendance/movement boundaries
- treat status='archived' and deleted=true as different things
- not manage my Supabase account (give me migration SQL + instructions)

Do NOT code yet. Produce an implementation plan for TICKET-01 only, then wait for approval.
```

---

## 9. Definition of Done (Whole MVP)

On a phone, fully offline: unlock with a PIN; add/manage students with photos + ID images; assign rooms; record fees **with due dates** and accurate, correctly-flagged dues; mark attendance (overnight-leave default); log the three movement types with the one-open-log rule and see "out now"/"overdue"; see a live dashboard with reminders. Changes **sync automatically** when back online; opening the app on a **laptop** shows the same synced data; the cloud holds a current backup. The app installs to the home screen and starts with no internet. (Drive backup is a should-have, not required for MVP.)

Work the tickets in order. Verify against acceptance criteria. Keep it single-user, local-first, and simple.
