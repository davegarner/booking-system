# Roadmap

This page records what the **v1** FSW Booking System actually delivers, and the
enhancements that were **deliberately deferred** for a later version. Everything
in the "Future enhancements" section is **not yet built** — treat it as planning,
not as available functionality.

For how v1 is put live and verified, see [[Deployment]]. For the documentation
index that backs this roadmap, see the project `docs/README.md`.

---

## v1 status

**Phase status: Complete (v1).** The system meets all agreed requirements, and
the work was delivered across nine phases (0–8), each with its own design
document in `docs/`.

| Phase | Area | Status |
|---|---|---|
| 0 | Foundation | Complete |
| 1 | Auth & app shell | Complete |
| 2 | Employee availability | Complete |
| 3 | Time off & closures | Complete |
| 4 | Manager booking | Complete |
| 5 | Reschedule & cancel | Complete |
| 6 | Notifications & reminders | Complete |
| 7 | Reporting dashboard | Complete |
| 8 | Deployment & Sites embedding | Complete |

Each per-phase document records the design and rationale for that part of the
system; together they form the maintenance manual for v1.

---

## What is built (v1 scope recap)

The following capabilities ship in v1 and are exercised by the user-acceptance
test (UAT) matrix during go-live (see [[Deployment]]).

### Access & identity
- Role-aware web app: **manager view**, **employee view**, a **"No access"**
  notice for accounts not on the roster, and a **"Setup required"** notice
  before `setup()` has run.
- The app runs **as the owner** and re-derives the user from the Google session
  on every server call (`requireManager` / `requireSelfOrManager`). See
  [[Security and Permissions]].

### Employee availability (Phase 2)
- Per-employee **buffer** setting that persists.
- **Weekly** and **monthly** recurring availability patterns, listed in plain
  English.
- **One-off slots** and **exceptions**, with a **date-range preview** of free
  time per day. See [[Availability Engine]] and [[Employee Guide]].

### Time off & closures (Phase 3)
- Employees add **full-day and partial time off**.
- Managers add **company closures** and can add **time off on behalf of an
  employee**. See [[Manager Guide]].

### Booking (Phase 4)
- Manager booking flow: show free times, capture client + valid email, book.
- Rejects **overlaps**, bookings **inside an existing meeting's buffer**, and
  guarantees **exactly one** of two near-simultaneous bookings of the same slot
  succeeds. See [[Booking and Concurrency]].
- Adding time off over an existing meeting flags it (amber) into a
  **Conflicts to review** list rather than silently dropping it.

### Reschedule & cancel (Phase 5)
- Managers reschedule/cancel any meeting; employees reschedule/cancel **their
  own** from *My calendar*.
- Clashing reschedules are rejected; cancelling reopens the time; flags clear
  on reschedule/cancel.

### Notifications & reminders (Phase 6)
- Booking, reschedule and cancel emails to **client, employee and manager**.
- Hourly trigger runs `sendDueReminders`; reminder lead time controlled by
  `reminderLeadHours`; reminders are **not re-sent** on a later run. See
  [[Notifications]].

### Reporting (Phase 7)
- Per-employee **booked / offered / utilisation** and **by-type** tables over a
  date range (e.g. last 30 days).

### Auditing
- Every change is recorded in the append-only `AuditLog`
  (`BOOK` / `RESCHEDULE` / `CANCEL` / `FLAG`, with who and when). See
  [[Data Model]].

### Deployment & embedding (Phase 8)
- Web app deployed **Execute as: Me**, **access: Anyone within the domain**.
- Embedded in a **Google Site** via the `/exec` URL, with a **new-tab fallback
  link** for browsers that block third-party iframes/cookies. See
  [[Deployment]].

---

## Future enhancements (not yet built)

> **None of the items below exist in the current system.** They were recorded in
> the Phase 8 deployment document as natural next steps if wanted later. There is
> no schedule or commitment attached to any of them.

### Google Calendar sync
**Status: deferred (not built).** Mirror bookings into employees' Google/Outlook
calendars. Noted as relatively easy in this ecosystem, but deliberately left out
of v1. Would build on the existing booking and notification flows
([[Booking and Concurrency]], [[Notifications]]).

### Recurring client meetings
**Status: deferred (not built).** Book the same client on a repeating schedule in
a single action. Deferred during planning. v1 books meetings individually; this
would extend the manager booking flow ([[Manager Guide]]).

### In-app roster editing
**Status: deferred (not built).** Add or deactivate staff from within the app,
without using the Apps Script editor. Today this is done with `addEmployee(...)`
and by setting a `Users` row's `active` to `FALSE` (see [[Configuration]] and
[[Data Model]]). This enhancement would surface those operations in the UI.

### Booking archival for scale
**Status: deferred (not built).** Archive old bookings to keep the "hot" working
data small as years of history accumulate. v1 keeps all data in one Google Sheet
and preserves history and past bookings indefinitely. Relevant background in
[[Data Model]] and [[Architecture]].

### SMS reminders
**Status: deferred (not built).** Send reminders by text message in addition to
email. Would require a **paid SMS gateway**, which is why it was left out of v1.
Would extend the current reminder mechanism ([[Notifications]]).

---

## Summary

| Enhancement | Built in v1? | Notes |
|---|---|---|
| Google Calendar sync | No (deferred) | Easy in this ecosystem; deliberately deferred |
| Recurring client meetings | No (deferred) | Deferred in planning |
| In-app roster editing | No (deferred) | Currently done via editor / `Users` tab |
| Booking archival for scale | No (deferred) | Keep hot data small as history grows |
| SMS reminders | No (deferred) | Needs a paid SMS gateway |

For where these would slot into the system, start from [[Architecture]] and the
[[Developer Guide]]; for current configuration knobs, see [[Configuration]].
