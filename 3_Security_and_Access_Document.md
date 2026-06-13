# Security & Access Document — v7
## HostelDesk — Local-First Hostel Management App (Offline + Cloud Sync)

**Author:** Security Engineering
**Version:** 7.0 (Correctness-Hardened)
**Last Updated:** June 2026
**Written for:** A non-technical founder

> **What changed from v5:** Sharpened the overdue rule to its exact past-due formula, and added the **offline duplicate-movement conflict** as an explicit integrity/edge case (two devices check the same student out → flagged for manual resolution, never silently dropped).

---

## 1. Authentication Method

**Two simple layers:**
1. **Cloud login — email + password (Supabase Auth), once per device.** Ties all data to your account; enables sync + cloud backup.
2. **Local app lock — PIN, with optional biometric.** Quick daily unlocking without re-entering the cloud password.

**Set up:**
- Create your **one cloud account**; **turn off public sign-ups** afterward.
- Enable **password recovery** (and optionally 2FA).
- On each device, log in once, then set a **PIN/biometric**.
- Enable **idle auto-lock** so a left-open phone at the gate isn't exposed.

---

## 2. User Roles — Who Can Do What

Effectively **one role: you**, protected at two levels.

| Who | Can do | Cannot do |
|---|---|---|
| **You (logged in + unlocked)** | Everything: students, documents, fees, attendance, movement, rooms, sync, backup. | Nothing restricted. |
| **Someone holding your locked device** | Nothing until the PIN/biometric is entered. | See or change any data. |
| **Anyone else on the internet** | Nothing — the cloud only returns rows owned by your account. | Read or write your data. |
| **Students** | Nothing — no access at all. | — |

**Plain-English rule:** your cloud data is reachable only by your account; your device data only after unlocking.

---

## 3. Data Protection (Cloud + Device + Drive)

### In the cloud
- **Every row is tagged with `owner_id`.** Row-level security allows reading/writing a row **only when `owner_id` = the logged-in user** — so even though the app's public key is visible, the cloud refuses your data to anyone else.
- **Images** live in a **private storage bucket**, served via short-lived **signed URLs** — never public links.

### On the device
- The **app lock** guards the UI.
- The **Dexie cache, outbox, and file blobs** live in the app's private IndexedDB, unreadable by other apps.
- **PIN is stored hashed**, never plain text.
- Rely on the **device's full-disk encryption**; optionally encrypt cached ID images with a key derived from the PIN.

### In Google Drive (if you enable Drive backup)
- The backup files (Excel + JSON) contain your full records; the **JSON includes ID images**. Treat them as confidential.
- They're saved to **your own Drive** under your Google account — not shared by default.
- Consider a dedicated, non-shared folder; avoid forwarding these files.

### In transit
- All cloud and Drive communication is over **HTTPS**.

---

## 4. Data Integrity Rules (New)

These keep records trustworthy and prevent the app from inventing nonsense:

- **Archive ≠ delete.** A student leaving the hostel is **archived** (`status='archived'`, history kept). The **`deleted`** flag is only for genuinely removed rows and is what propagates a removal across devices. The app must never hard-delete and must never archive by deleting.
- **One open movement per student.** A student cannot be checked out twice. Enforced in app logic *and* by a database rule. Attempting a second check-out is blocked with a clear message.
- **Overdue is real, not guessed.** A student is overdue only when their **past-due balance** is positive: `overdue_balance = SUM(amount_due where due_date < today) − SUM(all amount_paid)`, and `overdue_balance > 0`. Fees with no due date, or future due dates that are already covered, don't count. The app must not fabricate overdue status or compute it per-row.
- **Attendance defaults, never auto-writes.** If an open overnight/home-visit covers a date, attendance pre-selects **leave** as a suggestion, but the warden confirms. Movement data never silently writes attendance.

---

## 5. Error Handling Guide — Major Failure Points

| Failure point | What can go wrong | How the app should respond |
|---|---|---|
| **Cloud login** | Wrong credentials | "Incorrect email or password." |
| **App unlock** | Wrong PIN | "Incorrect PIN" — stay locked; delay after several tries. |
| **Idle timeout** | App left open | Auto-lock; require PIN again. |
| **Offline action** | No internet while saving | Save locally + add to outbox; "Saved — will sync when online." Never block. |
| **Sync push fails** | Server unreachable mid-sync | Mark outbox item `failed` with `last_error`; retry automatically; show "Pending sync." |
| **Sync conflict** | Same row changed on two devices | Last-write-wins by `updated_at`; log the overwritten version. |
| **Second check-out (same device)** | Student already has an open log | Block: "This student is already checked out." |
| **Duplicate check-out (two offline devices)** | Both devices checked the same student out; cloud rejects one on sync | Mark the rejected outbox item **`conflict`**, keep it visible, and ask the user to resolve: "Two check-outs exist for Student A — keep which one?" Never silently drop a gate event. |
| **Fee without due date** | Due date left blank | Either require it or treat the fee as not-yet-due; never guess overdue. |
| **Image upload** | Too large / wrong type / offline | Compress; if offline, keep blob `local_only` and queue a `file_upload`; "Will upload when online." |
| **Room over capacity** | Room full | "Room A-101 is full (4/4)." |
| **Record fee** | Negative / non-numeric | "Enter a valid amount." |
| **Duplicate attendance** | Same student twice in a day | Overwrite, don't duplicate. |
| **Movement: missing expected return** | Overnight/home-visit without return time | Require it: "Set an expected return." |
| **Drive backup** | Drive not authorized / upload fails | "Couldn't reach Google Drive — try again," keep local + cloud data intact. |
| **Backup import** | Wrong/corrupt file | "Not a valid HostelDesk backup"; leave current data untouched. |
| **Storage full / evicted** | Out of space or cache cleared | "Not enough space" / request persistent storage; re-pull from cloud to rebuild. |
| **Accidental delete** | Removing a record by mistake | Confirm dialog; soft-delete (syncs), not a hard wipe; leavers use archive instead. |

**Golden rule:** clear human messages, the app stays usable offline, and **no action is lost** — failed syncs/uploads wait in the queue rather than dropping data.

---

## 6. Edge Cases to Handle Before Launch

1. **Same student edited on phone and laptop while both offline** — newer `updated_at` wins; overwritten version logged.
2. **New device setup** — after login, pull everything to build the Dexie cache before showing data.
3. **Offline-created records** — device-generated UUIDs so two offline rows never collide.
4. **Soft-deletes vs archive** — a deleted row stays deleted after sync (no zombies); an archived student stays visible in history.
5. **One-open-movement rule** — never two open logs; a forgotten-open log can be closed manually. **If two offline devices both check the same student out, the cloud rejects one on sync — that item becomes a `conflict` and waits for your decision; it is never auto-dropped.**
6. **Overnight/home-visit spanning days** — record correctly; attendance suggests "leave," never false "absent."
7. **Due-date overdue** — overdue uses the past-due portion only: `overdue_balance = SUM(amount_due where due_date < today) − SUM(all amount_paid) > 0`.
8. **Leaver re-admission** — reactivate an archived student with history intact.
9. **Room reassignment** — fix occupancy on both rooms.
10. **Partial / advance fees** — show remaining balance / handle prepayment.
11. **Mid-month admission** — don't count pre-admission days as absent.
12. **Sensitive backups** — Drive JSON contains ID images; keep the folder private; warn the user.
13. **Time zone (IST) across devices** — store UTC, display IST.
14. **Persistent storage denied** — warn and push PWA install; the cloud still holds the data.
15. **Forgotten cloud password** — ensure recovery is set up before relying on the app; the cloud copy is the safety net.
16. **Long offline period** — a large outbox should sync in batches with clear progress.
17. **Wrong device clock** — `updated_at` is set authoritatively by the cloud on sync, so a phone with an incorrect clock cannot win a conflict and overwrite correct data; the device timestamp is only a local ordering fallback.
18. **App update / schema change** — local Dexie upgrades are versioned and migrate existing rows; a new app version must never wipe the offline database.
19. **Out-of-order offline creation** — if a student and their fee are both created offline, the fee must sync after the student (outbox is FIFO + parent-before-child); a child whose parent failed to sync waits rather than erroring.
20. **Midnight/day-boundary** — attendance and movement use the IST calendar day; an overnight leave crossing midnight covers both days for the attendance default.

Handling these before launch prevents the failures that matter most: **lost edits, sync drift, zombie/duplicate records, fake overdue flags, clock-skew clobbering, and data loss on app upgrade.**
