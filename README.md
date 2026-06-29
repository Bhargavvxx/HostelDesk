# HostelDesk

## Project Overview
HostelDesk is a single-user, local-first Progressive Web Application (PWA) built to manage a single hostel. It provides comprehensive management of rooms, students, fees, attendance, and student movement (gate passes), working seamlessly both offline and online. Data is saved locally first for instant response times and synced automatically to a cloud backend in the background.

## Problem Statement
Hostel wardens and managers often operate in environments with spotty or unreliable internet connections. Traditional cloud-dependent web apps block users from working when offline, causing frustration and delays in critical tasks like marking attendance or logging check-outs. HostelDesk solves this by adopting a local-first architecture where the application is always available and fully functional without an internet connection.

## MVP Status
- **Completed:** TICKET-01 through TICKET-15, TICKET-17, TICKET-18
- **Deferred:** TICKET-16 Google Drive Backup
- **Ready for:** Physical device QA and deployment setup.
- **Current local tag:** `mvp-local-first-complete`

## Key Features
- **Installable PWA:** Installs to the home screen on phones and laptops; launches instantly even with the network fully off.
- **Local-First & Offline-First:** Reads and writes to a local database first. Never blocks the user waiting for a network request.
- **Automatic Background Sync:** Changes sync transparently when the device comes back online.
- **Robust Conflict Resolution:** Handles cross-device edits and duplicate gate check-outs safely.
- **Data Export & Backup:** Export reports to CSV/Excel or backup the entire database to a JSON file.
- **App Lock:** Secure the app locally with a PIN, on top of the cloud login.
- **Dark Mode:** Polished dark mode support with accessible contrast.

## Architecture Overview
HostelDesk uses an "outbox + pull-changes" pattern. The UI strictly interacts with the local Dexie.js (IndexedDB) database. Every local write appends an item to a local `outbox` queue. A background sync engine continuously processes this queue (FIFO, parent-before-child), pushing mutations to Supabase when online. It then pulls any remote changes (using `last_synced_at` timestamps) to update the local database using a "last-write-wins" strategy driven by cloud-authoritative timestamps.

## Tech Stack
- **Framework:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4 + shadcn/ui + lucide-react
- **Local Database:** Dexie.js (IndexedDB wrapper)
- **Cloud Backend:** Supabase (Postgres + Auth + Storage)
- **State Management:** Zustand + TanStack Query
- **PWA Support:** vite-plugin-pwa (Workbox)
- **Export/Parsing:** papaparse (CSV), xlsx (Excel)

## Local-First Design Explanation
In HostelDesk, the local database is the primary source of truth for the UI. When you create a student or log a fee, the app writes it directly to Dexie and updates the screen instantly. You do not see loading spinners while waiting for a server. The cloud serves as a durable backup and a conduit for syncing data to your other devices (e.g., your laptop and your phone).

## Offline-First Sync Explanation
The sync engine operates completely in the background:
1. **Push:** Pending outbox items are pushed sequentially to Supabase.
2. **Files:** Images are queued locally in `file_blobs`, uploaded to Supabase Storage, and their cloud paths are linked to the domain records.
3. **Pull:** The engine fetches only rows that have changed in the cloud since the last pull and applies them locally.
4. **Resilience:** If the network drops, sync pauses and resumes seamlessly. Failed items retry automatically (up to 5 times) before being flagged for manual review.

## Authentication and Local Lock
- **Cloud Auth:** Supabase email/password login is required once per device to establish the sync session. Public sign-ups are disabled.
- **Local Lock:** A hashed 4-digit PIN secures the app on the device for day-to-day use, with idle auto-lock to protect unattended devices.

## Database Design Summary
The schema consists of two sets of tables:
1. **Synced Tables (Mirrored in Postgres):** `rooms`, `students`, `student_documents`, `fee_records`, `attendance`, `movement_logs`. Every row has a UUID (device-generated), `owner_id`, `updated_at`, and `deleted` flag.
2. **Local-Only Tables (Dexie only):** `outbox` (mutation queue), `file_blobs` (offline image queue), `sync_state` (pull timestamps), and `app_settings` (PIN hash, logs).

## Supabase Backend Summary
Supabase provides the Postgres database, Auth, and object Storage. Row-Level Security (RLS) is strictly enforced on all tables so that a user (defined by `owner_id`) can only read and write their own data. A partial unique index in Postgres enforces the business rule that a student can only have one open movement log at a time.

## Screens and Features by Module

### Dashboard / Reminders
- Live statistics (present today, out now, total dues, free beds).
- Intelligent reminders for overdue fees and overdue returns.
- Sync status and conflict alerts.

### Rooms
- Create and manage rooms with specific capacities.
- Live occupancy tracking prevents over-assignment.

### Students
- Full CRUD operations with soft-delete and archive functionality (archive keeps history; delete removes from sync).
- Photo capture/upload works fully offline.

### Documents / Images
- Attach ID proofs and admission forms. Images are stored securely via signed URLs.

### Fees and Dues
- Record fee dues, partial payments, and advance payments.
- Overdue status is computed exactly based on `due_date`, never guessed.

### Attendance
- Daily attendance roll (Present/Absent/Leave).
- Automatically suggests "Leave" if the student has an open overnight or home-visit gate pass for that day (IST boundaries).

### Movement / Out-Pass System
- Log casual exits, overnight leaves, and home visits.
- Expected return times drive "Overdue to return" alerts.
- Enforces a strict one-open-log-per-student rule.

### Backup / Export
- **JSON Full Backup:** Download a complete snapshot of local database records for safekeeping or manual migration. Local unsynced image blobs are embedded as Base64 when present. Already-synced images are stored as Supabase Storage cloud paths and are not embedded in the JSON file.
- **CSV / Excel Export:** Download human-readable reports of all domain tables.

### Sync / Conflict Management
- Dedicated `/sync` screen for managing sync health.
- Resolve duplicate movement conflicts (e.g., if two devices check out the same student while offline).
- Review high-attempt failed items and the "Recently Overwritten" log.

### Dark Mode / UI Polish
- Comprehensive dark mode support with accessible contrast ratios.
- Friendly empty states, error boundaries, and success banners.

## Sync Engine Details
- **Outbox Queue:** FIFO processing guarantees order of operations.
- **Dependency Ordering:** The `depends_on` field ensures a parent record (e.g., Student) syncs before a child record (e.g., Fee), avoiding foreign key errors.
- **File Upload Flow:** Files are stored in `file_blobs` as `local_only`, marked `uploading`, and upon success, the domain record receives the cloud path.
- **Retry Behavior:** Network failures auto-retry up to 5 times. High-attempt failures surface in the `/sync` UI for manual retry or removal.
- **Conflict Handling:** Server-authoritative `updated_at` resolves general conflicts (last-write-wins). Postgres constraints (like duplicate movements) flag the outbox item as a `conflict` for manual resolution.

## Backup and Export Details
- **JSON Full Backup:** A versioned envelope containing all tables, allowing full destructive restore on another device. **Note:** JSON backups include local unsynced image blobs. Synced images are referenced by cloud storage paths and require Supabase Storage availability (they are not embedded in the JSON).
- **CSV & Excel Export:** Read-only snapshots intended for printing or sharing (does not include internal sync tables or file blobs).
- **Restore Safety:** Restoring from JSON requires explicit confirmation as it completely replaces the current local database.
- **Privacy Warning:** Backups contain PII. Users are warned to store exported files securely.

## Security & Privacy Notes
- The database uses local device storage (IndexedDB).
- The Local PIN is hashed using PBKDF2-HMAC-SHA256 with 100,000 iterations; the raw PIN is never stored.
- Supabase RLS guarantees cloud isolation between user accounts.
- Private Storage Buckets ensure images are accessible only via short-lived signed URLs.

## Google Drive Status
- ⏸️ **Explicitly Deferred.**
- The "Backup to Google Drive" feature requires a verified Google Cloud Project, OAuth consent screen, and client credentials.
- It is not currently implemented in the UI to prevent user confusion.

## Folder Structure
```text
hosteldesk/
├── src/
│   ├── cloud/          # Supabase client and auth logic
│   ├── components/     # UI components (shadcn) and feature modals
│   ├── hooks/          # Zustand stores (useAuthStore)
│   ├── lib/            # Utilities, formatting, lock logic
│   ├── local/          # Dexie DB setup, schema, domain queries
│   ├── routes/         # Top-level screen components
│   └── sync/           # Outbox push, pull, files, engine loop
├── supabase/
│   ├── migrations/     # Cloud SQL schema
│   └── policies.sql    # Row-Level Security
```

## Environment Variables
Create a `.env` file in the root:
```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Setup Instructions
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Configure the `.env` file.

## Supabase Setup Instructions
1. Create a new Supabase project.
2. Apply the SQL from `supabase/migrations/` to create the tables.
3. Apply `supabase/policies.sql` to enable RLS.
4. Create a storage bucket named `hosteldesk-files` and set it to **Private**.
5. Disable public sign-ups in Supabase Auth settings. Create your user account manually via the Supabase dashboard.

## Running Locally
```bash
npm run dev
```

## Build Commands
```bash
# Typecheck and build for production
npm run build

# Preview production build locally
npm run preview
```

## PWA Notes
The app uses `vite-plugin-pwa` (Workbox) to generate a service worker. When built for production and served over HTTPS (or localhost), browsers will offer to "Add to Home Screen". Once installed, the app caches its shell and will launch even without an internet connection.

## Testing / QA Checklist
- [ ] Log in and set a PIN.
- [ ] Turn off internet connection (Airplane mode / offline via DevTools).
- [ ] Create a room, student, and mark attendance.
- [ ] Turn internet back on.
- [ ] Verify the Sync Indicator shows uploading, then turns green (Synced).
- [ ] Verify data appears in the Supabase dashboard.
- [ ] Test resolving a duplicate movement conflict in the `/sync` screen.

## Known Limitations
- Single-user only. There are no admin/warden role separations yet.
- Biometric lock (WebAuthn) is not implemented; only the PIN lock is active.
- No automated PDF receipt generation.

## Future Work
- Google Drive automatic backups (TICKET-16).
- Multi-user RBAC (Role-Based Access Control) for larger hostels.
- Automated monthly fee generation.

## License
[MIT License]
