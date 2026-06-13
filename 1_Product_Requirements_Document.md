# Product Requirements Document (PRD) — v7
## HostelDesk — Local-First Hostel Management App (Offline + Cloud Sync)

**Author:** Product Management
**Version:** 7.0 (Local-First + Cloud Sync, Correctness-Hardened)
**Last Updated:** June 2026

> **What changed from v6:** No product/scope changes. v7 adds four correctness safeguards for the build agent, all in the Technical Architecture / Security / Ticket docs: (1) a **Dexie schema-versioning** rule so local upgrades never wipe data, (2) **cloud-authoritative `updated_at`** so a wrong device clock can't clobber good data, (3) a **day-boundary rule** (IST) for attendance/movement, and (4) **FIFO + dependency-ordered outbox** processing so related offline changes sync in the right order. This PRD is unchanged in substance.

---

## 1. Overview

### What the app does
HostelDesk is a single-operator hostel management app that records and manages students: profiles with ID documents, fees and dues (with due dates), daily attendance, room allocation, and a smart movement system (casual exit / overnight leave / home visit). It installs to your phone and laptop, works fully offline, **syncs automatically** to the cloud, and can additionally **back up to your Google Drive** as Excel + JSON.

### Who it is for
One user: **you**, the warden/owner. Single-user, personal. Students never log in. Used on your phone and laptop, each holding a live offline cache that syncs to your cloud account.

### What problem it solves
Hostel records scattered across paper, WhatsApp, and spreadsheets cause unclear dues, no reliable record of who's present, error-prone attendance, no fast answers to "who hasn't paid?" or "who's out and overdue?", and no safe backup. HostelDesk centralizes this into one fast app that works with no signal at the gate, keeps data safe in the cloud (and optionally Drive), and stays in sync across devices.

### Why local-first + cloud sync
Gates often have poor connectivity, so the app must work offline instantly. You also want phone and laptop to agree and your data backed up. Local-first gives instant offline operation; cloud sync gives multi-device consistency and backup — without making the network a requirement for daily use.

---

## 2. Core Features

### Must-have (MVP)
| Feature | Description |
|---|---|
| Account & app lock | One cloud login per device (for sync), plus a local PIN/biometric to open the app. |
| Offline-first operation | Every core action works with no internet; changes queue in an outbox and sync when back online. |
| Auto cloud sync | Changes propagate between phone, laptop, and cloud automatically; last-write-wins. |
| Student records + documents | Profiles, optional photo, attached ID/admission images (cloud storage, cached locally). **Archive** (left hostel) keeps history. |
| Smart movement | Casual exit / overnight leave / home visit, each with expected return. **Only one open movement per student.** Live "Out now" and "Overdue to return." |
| Fee management | Fee logging with **due date**, partial & advance payments, auto-calculated dues, real overdue flags. |
| Attendance | Daily present/absent/leave, respecting admission date; suggests "leave" when an overnight/home-visit covers the date. |
| Room management | Rooms with capacity and live occupancy; assign/unassign. |
| Dashboard | Live snapshot: present today, out now, overdue returns, total dues, free beds, plus sync status. |
| Reminders | Surfacing of overdue fees (by due date) and late returns. |
| Sync status & local backup | Clear synced/pending/offline indicator; CSV + full JSON export. |
| Drive backup (optional) | One-tap "Backup to Google Drive" saving Excel (browsable) + JSON (full restore with images). |
| Search & filter | Instant lookup by name, room, or dues status. |

### Should-have (fast-follow)
| Feature | Description |
|---|---|
| Photos in "Out now" | Quick visual ID of who's currently out. |
| Per-student quick stats | Attendance %, total paid, leave count on profile. |
| Dark mode | Light/dark toggle. |
| Auto Drive backup | Scheduled (e.g. daily) Drive backup instead of manual. |

### Removed / deferred (to stay simple)
| Removed | Why |
|---|---|
| Complaints/maintenance, visitor log, room history, mess fees | Not core; keep the app focused. |
| Charts/trends, server-side report engine | CSV/Excel export covers real needs. |
| Multi-warden roles, multi-tenant RLS | Single user; one account owns all data. |
| CRDT/real-time collaborative sync | Overkill for one editor; last-write-wins suffices. |

---

## 3. User Flow (Start to Finish)

1. **Open app** → unlock with PIN/biometric. (First time on a device: log into your cloud account once.)
2. **Dashboard** → today's snapshot + reminders + sync indicator (synced / syncing / offline).
3. **Onboard a student** → details → optional photo + ID image → assign room → set fees **with a due date**. (Saved locally instantly; synced when online.)
4. **Daily operations (work offline):**
   - *Movement:* student leaving → search → pick type → set expected return → Check Out (blocked if they already have an open log). On return → Check In. Late students appear under **Overdue to return**.
   - *Attendance:* mark the day's roll; students on an open overnight/home-visit pre-fill as "leave."
   - *Fees:* record a payment → dues recalc instantly; overdue is computed from due date.
5. **Reconnect** → queued changes sync automatically; indicator returns to "synced."
6. **Switch devices** → open on laptop; it pulls the latest and shows the same data.
7. **Back up** → optionally tap "Backup to Drive" for Excel + JSON copies.
8. **Maintain** → edit details; **archive** leavers (history preserved).

---

## 4. MVP Definition

MVP is complete when, on your phone: you log into your cloud account once and set a PIN; add/manage students with photos and ID images; assign rooms; record fees **with due dates** and see accurate, correctly-flagged dues; mark attendance (with the overnight-leave default); log the three movement types with the one-open-log rule and see "out now" + "overdue"; and see a live dashboard with reminders. All of this works **offline**, changes **sync automatically** when back online, and opening the app on your **laptop** shows the same synced data. The app installs to the home screen and launches offline. (Drive backup is a should-have, not required for MVP.)

---

## 5. Success Metrics

- **Adoption:** paper/spreadsheets dropped within 2 weeks.
- **Offline reliability:** every core action works at the gate with no signal.
- **Sync correctness:** offline phone edits appear on the laptop after reconnect, no data loss, no duplicate/zombie rows.
- **Data safety:** cloud (and optionally Drive) holds a current copy; restoring on a fresh device reproduces everything.
- **Fee accuracy:** dues and overdue flags match reality (driven by due dates), zero manual reconciliation.
- **Movement integrity:** never two open logs for one student; "overdue returns" catches late students.

---

## 6. Out of Scope for Version 1 (Deliberately NOT building)

- **Multi-user / multi-warden / parent access** — single user.
- **Real-time collaborative editing / CRDT merge** — last-write-wins is enough.
- **Online payment collection** — fees recorded, not collected.
- **Biometric/RFID gate hardware** — manual taps.
- **SMS/WhatsApp/push sending** — in-app reminders only.
- **Complaints, visitor log, mess fees, room history, charts** — cut to stay simple.
- **Multi-hostel** — single tenant.

This keeps the promise focused: a fast, offline-capable, cloud-synced, single-user record-keeper that works anywhere, stays consistent across phone and laptop, and keeps your data safe.
