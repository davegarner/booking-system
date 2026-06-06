# Architecture

This page is the conceptual big picture of the FSW Booking System: what the pieces
are, how a request flows through them, and the "expensive-to-change" foundation
decisions that everything else depends on. For deeper detail, follow the links to
the focused pages.

See also: [[Home]] · [[Getting Started]] · [[Data Model]] · [[Availability Engine]] ·
[[Booking and Concurrency]] · [[Deployment]] · [[Developer Guide]].

## The big picture

FSW is a ~10-person business that arranges client meetings. The system gives them
one reliable, no-extra-cost place to manage all client scheduling, built entirely
inside their existing **Google Workspace**.

- **A Google Apps Script web app** is the application — it runs server code and serves
  the HTML UI, with **zero hosting cost** and no build pipeline.
- **A single Google Sheet** is the datastore (one tab per entity). There is no
  database to run; the owner can see, edit, back up, and export the data directly.
- **Google Sites** is where the app surfaces — the app is embedded as an iframe in
  the company intranet that already lives there.

There are exactly two kinds of user:

| Role | What they do |
|---|---|
| **Employee** (~10) | Maintains *their own* availability — the times they are free to take clients. |
| **Manager** (1) | Sees everyone's availability in one combined view and books client meetings into it. |

**Clients never log in.** They contact the business as they do today; the manager
records the client's details and assigns the meeting. The model is therefore
**manager-assigns-everything** — there is no public booking page and no client
accounts, which keeps the system entirely internal and simplifies the whole design.

## Deployment model (and why it matters)

The app is deployed as a Web app with two settings that work together:

- **Execute as:** `Me (the owner)`
- **Who has access:** `Anyone within <the company's domain>`

Because every user shares one Workspace domain, this combination buys a lot at once:

- The app still learns each visitor's real email (`Session.getActiveUser().getEmail()`),
  so **role-based routing works** even though the code runs as the owner.
- There is only a **one-time owner authorization** instead of a prompt for every
  employee.
- The **data Sheet stays private to the owner** — it is never shared with ten people;
  all reads/writes go through the single owner identity.
- It **embeds cleanly** inside the Google Sites iframe.

Because the server runs with the owner's full permissions, **the server never trusts
the browser about identity**: every server function re-derives who you are from the
Google session and re-checks your role before acting. See [[Security and Permissions]]
and [[Deployment]] for the full reasoning and the deployment steps.

## Decisions that are expensive to change later

These were locked at the foundation because reversing them would mean a data
migration. They constrain everything downstream, so they are worth knowing.

1. **UTC epoch-millisecond storage, one business timezone.** Every stored instant is
   a plain integer (`*Ms` columns), never a wall-clock string like `"2026-06-09 14:00"`
   (those corrupt across daylight-saving boundaries and timezone mismatches). One
   business timezone lives in `Config.timeZone` (default `Europe/London`); recurring
   rules are written as wall-clock and resolved against that zone for a specific date.
   See [[Configuration]] and the time-handling notes in [[Availability Engine]].
2. **Availability is computed on the fly, never materialized.** The only persisted
   facts are recurring rules, one-off additions, exceptions, time off, closures, and
   bookings. Free time is *derived* by interval subtraction every time it's needed.
   A direct benefit: cancelling or rescheduling a meeting reopens its time
   automatically, because the engine simply stops subtracting it. See
   [[Availability Engine]].
3. **UUID primary keys.** Every row has a `Utilities.getUuid()` ID; other tabs
   reference those IDs, never names or emails (which can change).
4. **Append-only audit + soft-delete.** The `AuditLog` tab is append-only, and rows
   are never hard-deleted — `active` is a real boolean and cancel/soft-delete sets it
   false while keeping the row. History is preserved for accountability and reporting.
5. **Buffers are snapshotted onto each booking** (`bufferBeforeMin` / `bufferAfterMin`).
   If an employee later changes their buffer, existing bookings keep the gap they were
   made with — no retroactive phantom clashes.
6. **Half-open intervals `[start, end)`** everywhere, so a meeting ending at 14:00 and
   one starting at 14:00 do not overlap (before buffers are applied).

## Request flow walkthrough

A round trip from a visitor's browser to the Sheet and back:

```
Browser (Google Sites iframe)
   │  GET the /exec URL
   ▼
doGet (Code.gs)
   │  resolve user context from Session.getActiveUser()
   │  match email (case-insensitively) against the Users tab → { role, userId, ... }
   ▼
Role decision
   ├─ system not initialised  → "Setup required" notice (run setup())
   ├─ email not on roster     → "No access" notice
   ├─ manager                 → Manager view (ui/Manager.html)
   └─ employee                → Employee view (ui/Employee.html)
   │  chosen view injected into ui/Index.html + bootstrap data (name, role, tz, company)
   ▼
Browser renders the shell, then makes feature calls
   │  google.script.run.<serverFn>(args)   (wrapped as a promise in ui/JsCommon.html)
   ▼
Server API (AvailabilityApi / TimeOffApi / BookingApi / Reporting)
   │  1. re-check identity + role via an Auth.gs guard
   │  2. apply business rules (e.g. availability, validation, lock on booking writes)
   │  3. record the change via AuditLog.logAudit(...)
   ▼
SheetDAL.gs  ── the only module that touches the Sheet ──▶  Google Sheet tabs
   │  bulk read / append / update-by-id (logAudit appends through here too)
   ▼
Result returned to the browser, UI updates
```

Key points in this flow:

- **Routing** (`doGet` in `Code.gs`) chooses the view; the shell is assembled from
  small HTML partials so each feature only fills its own panel. See [[Getting Started]].
- **Identity is never taken from the client.** Each server function re-derives it and
  calls one of the `Auth.gs` guards — `requireAuthorized()`, `requireManager()`, or
  `requireSelfOrManager(userId)`. See [[Security and Permissions]].
- **Booking writes are serialized** with `LockService` (`withScriptLock` in
  `SheetDAL.gs`) so two people can never double-book the same slot. See
  [[Booking and Concurrency]].
- **Every mutation is audited.** `AuditLog.gs` appends an immutable before/after row.

## Module map

All code lives in `src/` as Apps Script (`.gs`) files plus HTML partials in `src/ui/`.
Grouped by area:

| Area | Modules | Responsibility |
|---|---|---|
| **Foundation** | `Schema.gs` | Single source of truth: tab names, column order, format hints, all enums, primary-key map, time constants. |
| | `Config.gs` | Reads the `SHEET_ID` script property and the `Config` tab over `DEFAULTS`; exposes `getConfig(key)` and `getTz()`. |
| | `TimeUtil.gs` | DST-safe conversion between wall-clock and epoch-ms; local calendar maths. The most correctness-critical module. |
| | `SheetDAL.gs` | The only place that touches the Sheet: bulk reads, append, update-by-id, brief caching, and `withScriptLock` (the concurrency guard). |
| | `AuditLog.gs` | `logAudit(...)` appends immutable history; `getAuditFor(id)` reads it back. |
| | `Setup.gs` | `setup()` bootstraps the spreadsheet/tabs/formats and seeds Config + first manager; `addEmployee(...)` adds people. |
| | `Tests.gs` | `runAllTests()` — pure unit tests for the engine and timezone logic. See [[Testing]]. |
| **Availability** | `AvailabilityEngine.gs` | Interval algebra + `computeFreeRanges`; split into a pure function and a thin loader. See [[Availability Engine]]. |
| | `AvailabilityApi.gs` | Server API behind the employee availability screen (rules, additions, exceptions, buffer). |
| **Auth & shell** | `Auth.gs` | Identity resolution and the three authorization guards. |
| | `Code.gs` | `doGet` routing, the `include()` partial helper, and the `getServerInfo` probe. |
| | `ui/Index.html`, `ui/Styles.html`, `ui/JsCommon.html`, `ui/Notice.html` | Page skeleton, styling, shared client JS (`google.script.run` wrapper, toasts, tabs, connection check), and the notice card. |
| **Employee** | `ui/Employee.html`, `ui/JsEmployee.html` | Employee view and its client logic. See [[Employee Guide]]. |
| **Time off / closures** | `TimeOffApi.gs` | Individual time off and company-wide closures, with warn-and-flag for affected bookings. |
| **Booking & lifecycle** | `BookingApi.gs` | Combined calendar, booking validation, the double-booking lock, reschedule and cancel. See [[Booking and Concurrency]]. |
| | `ui/Manager.html`, `ui/JsManager.html` | Manager view and its client logic. See [[Manager Guide]]. |
| **Notifications** | `Notifications.gs`, `Reminders.gs`, `Triggers.gs` | Email notifications, the 24-hour reminder, and the time-driven triggers that run them. See [[Notifications]]. |
| **Reporting** | `Reporting.gs` | Hours, utilisation, and by-meeting-type reporting for the manager. |

Supporting (not application logic): `appsscript.json` (manifest — timezone, V8 runtime,
web-app access/execute-as, OAuth scopes), `package.json` (clasp scripts),
`.claspignore` (push only `src/`).

## Where to go next

- New here? Start with [[Getting Started]].
- The Sheet tabs and columns: [[Data Model]].
- How free time is derived: [[Availability Engine]].
- How bookings avoid clashes: [[Booking and Concurrency]].
- Emails and reminders: [[Notifications]].
- Settings and the timezone: [[Configuration]].
- Going live in Google Sites: [[Deployment]].
- Function-level details: [[Developer Guide]] and [[API Reference]].
