# Frontend Specification Document — v7
## HostelDesk — Local-First Hostel Management App (Offline + Cloud Sync)

**Author:** UI/UX & Frontend Architecture
**Version:** 7.0 (Correctness-Hardened)
**Last Updated:** June 2026

> **What changed from v5:** No visual changes. The overdue pill now follows the precise **student-level** overdue rule (see Technical Architecture §4): a student is overdue when their **past-due balance** is positive — `SUM(amount_due where due_date < today) − SUM(all amount_paid) > 0` — not merely when any single fee row is late. Image fields follow the cloud-path vs local-blob naming convention.

---

## 1. Design Direction

**Calm, warm, confident — instant offline, honest about sync.** A daily tool used at a gate or desk, on phone and laptop. Clarity and big tap targets first; premium feel second. Every action writes locally and returns immediately; sync happens quietly in the background, always visible but never in the way.

---

## 2. Design System

### 2.1 Color Palette

Deep indigo primary + warm amber accent, full dark mode.

**Light mode**
| Token | Hex | Use |
|---|---|---|
| Primary | `#4F46E5` | Primary buttons, active nav, links |
| Primary Dark | `#4338CA` | Hover/pressed |
| Primary Soft | `#EEF2FF` | Selected rows, subtle fills |
| Accent | `#F59E0B` | "Out now" / needs-attention |
| Success | `#10B981` | Paid, present, checked-in, synced |
| Warning | `#F59E0B` | Partial dues, pending sync |
| Danger | `#EF4444` | Overdue, absent, destructive, sync error |
| Info | `#0EA5E9` | Offline indicator, neutral badges |
| Ink | `#0F172A` | Primary text |
| Muted | `#64748B` | Secondary text, labels |
| Border | `#E2E8F0` | Dividers, input borders |
| Surface | `#FFFFFF` | Cards |
| Canvas | `#F8FAFC` | Page background |

**Dark mode**
| Token | Hex |
|---|---|
| Canvas | `#0B1120` |
| Surface | `#111827` |
| Border | `#1F2937` |
| Ink | `#F1F5F9` |
| Muted | `#94A3B8` |
| Primary | `#6366F1` |
| Accent | `#FBBF24` |

### 2.2 Typography
- **UI font:** `Inter`. **Numbers:** tabular figures for fees/counts/dates.

| Style | Size / Weight | Use |
|---|---|---|
| Display | 32px / 700 | Dashboard hero numbers |
| H1 | 24px / 700 | Page titles |
| H2 | 18px / 600 | Section headers |
| Body | 16px / 400 | Default |
| Small | 14px / 400 | Labels, captions |
| Tiny | 12px / 600 | Badges, timestamps, sync chip |

### 2.3 Spacing & Layout
- **Scale (px):** 4, 8, 12, 16, 24, 32, 48, 64. **Grid:** 8px. **Padding:** 16px mobile / 24–32px desktop.
- **Max width:** 680px mobile, 1040px desktop. **Radius:** 16 cards/modals, 10 buttons/inputs, full pills.
- **Shadows:** card `0 1px 2px rgba(15,23,42,.04), 0 4px 12px rgba(15,23,42,.06)`; modal `0 12px 40px rgba(15,23,42,.18)`.

### 2.4 Component Styles
**Buttons** — 44px min, 10px radius, press-scale 0.98 (Primary / Secondary / Ghost / Destructive+confirm / Icon 44×44).
**Inputs** — 44px, Surface bg, 1px Border, 10px radius; focus ring `0 0 0 3px rgba(79,70,229,.15)`; error → Danger border + helper; visible labels. Includes a **date input** styled to match (used for fee due dates, attendance, expected return).
**Stat tiles** — Surface card, icon chip, Display number, Small label; category tint.
**Cards** — Surface, 16px radius, soft shadow, 16–20px padding.
**Status pills** — Success / Warning / Danger / Accent (out now); movement-type icons (casual / overnight / home visit). **Overdue pill** (Danger) appears only when the student's **past-due balance** is positive — i.e. `SUM(amount_due where due_date < today) − SUM(all amount_paid) > 0` — not merely when one fee row is late.
**Sync indicator** — header/dashboard pill: Synced (Success) / Syncing… (Info, spinner) / Pending N (Warning) / Offline (Info). Tap → last-sync time + "Sync now."
**Data lists** — hover tint, tabular numbers; stacked cards on mobile.
**Modals** — centered, max-width 480px, dimmed backdrop, scale-in; Ghost cancel / Primary confirm.
**Toasts** — brief confirmations ("Payment recorded ✓", "Saved — will sync when online", "Backed up to Drive ✓").
**Empty states** — icon + one line + primary CTA.
**Navigation** — mobile bottom tabs (Dashboard, Students, Movement, Fees, More); desktop sidebar + theme toggle + sync indicator.

### 2.5 Motion
150ms press / 200ms toast / 250ms modal; `ease-out` in, `ease-in` out; respect reduce-motion. Sync spinner subtle, non-blocking.

---

## 3. Integration Spec — Dexie Local Cache + Supabase Cloud + Drive

The frontend talks to the **local Dexie cache** (always, instantly) and **Supabase** (background, when online). Google Drive is used only by the Backup screen.

### 3.1 Local data layer (Dexie — primary path)
Every screen reads/writes Dexie and appends to the `outbox`:

| UI action | Local operation | Returns |
|---|---|---|
| List/search students | query Dexie `students` (+ filters) | rows with computed dues + overdue flag |
| Add/edit/archive student | write Dexie + enqueue outbox | updated row (instant) |
| Save photo/ID image | write `file_blobs` (status `local_only`) + enqueue `file_upload` | local blob id |
| Record fee | write `fee_records` (incl. **due_date**), recompute balance | new balance + overdue state |
| Mark attendance | upsert `attendance`; pre-fill `leave` if open overnight/home-visit covers date | saved row |
| Movement check-out | guard: block if an open log exists; else write `movement_logs` | open log |
| Movement check-in | update `check_in_time` | closed log |
| Out now / overdue | query open logs vs now | list with overdue flag |
| Dashboard summary | aggregate Dexie queries | counts + reminders + sync status |

### 3.2 Supabase cloud (background sync + auth)
| Action | Call | Data | Expected |
|---|---|---|---|
| Login | `signInWithPassword` | `{ email, password }` | session/error |
| Push changes | upsert with `owner_id`, `updated_at`, `deleted` | outbox batch | accepted rows |
| Pull changes | select where `updated_at > last_pulled_at` | per-table cursor | changed rows |
| Upload image | Storage upload (private bucket) | blob | cloud path |
| Get image link | Storage signed URL | path | short-lived URL |

All cloud access scoped to your account via row-level security; images via signed URLs.

### 3.3 Google Drive (Backup screen only)
| Action | Call | Data | Expected |
|---|---|---|---|
| Backup to Drive | Drive upload ×2 | `…_YYYY-MM-DD.xlsx` (sheets per table) + `…_YYYY-MM-DD.json` (full incl. images) | file IDs + "Last Drive backup" timestamp |

### 3.4 Offline / PWA UX
- **Install prompt** on first visit (home-screen install → reliable storage).
- **Launches offline** from the cached shell; no network spinner on open.
- **Sync indicator** always visible; never block an action when offline.
- **First-run on a new device:** "Setting up — downloading your data…" while the cache builds.
- **Backup screen:** CSV + JSON (local) and "Backup to Google Drive" (Excel + JSON), with last-sync/last-backup status.

---

## 4. Screen Inventory

| Screen | Key components |
|---|---|
| Login | Email/password, Primary button, error text (new device only) |
| Lock | PIN pad / biometric, error text |
| Dashboard | 5 stat tiles, "out now / overdue" list, reminders strip, **sync indicator + last-sync**, last-Drive-backup |
| Student list | Search, filter pills, student cards (photo + dues/overdue pill), empty state |
| Student detail | Profile, document/photo viewer, fee/attendance/movement history, edit |
| Add/Edit student | Form + room dropdown + image upload |
| Fees | Overview with status/overdue pills, record-payment modal **with due-date field**, balance summary |
| Attendance | Date picker, roll with present/absent/leave toggles (**leave pre-filled for open overnight/home-visit**), save + toast |
| Movement | Search, type selector + expected return, **one-open-log guard**, live "out now / overdue" with check-in |
| Rooms | Room cards with occupancy, add/edit modal |
| Backup | CSV + JSON export, **Backup to Google Drive** (Excel + JSON), last-sync/last-backup status |

Every screen follows the palette, spacing, motion, and component rules for a consistent, polished, offline-instant feel — with sync state always honestly visible.
