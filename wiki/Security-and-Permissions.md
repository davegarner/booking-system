# Security and Permissions

How the FSW Booking System decides **who you are** and **what you may do** — and why the
server is the only place those decisions are trusted. If you are setting the app up, read
this alongside [[Deployment]] and [[Configuration]]; for the code-level view see
[[Developer Guide]] and [[API Reference]].

---

## The security model in one breath

The web app is deployed **Execute as: Me (the owner)** with **access limited to "Anyone
within domain"** (`webapp.executeAs: USER_DEPLOYING`, `webapp.access: DOMAIN` in
`appsscript.json`). That single choice drives everything below:

- The server code runs with the **owner's** Google permissions, so the data spreadsheet is
  never shared with staff — every read and write goes through the one owner identity.
- Because everyone stays inside one Workspace domain, Google still reveals the visitor's
  real email via `Session.getActiveUser().getEmail()` (the same-domain exception), so there
  is **no separate login**.
- The flip side: under execute-as-me, *any* signed-in colleague could call *any* server
  function straight from browser developer tools, running with full owner rights. So the
  golden rule is:

> **NEVER trust the client.** The browser may send an email, role, or `userId`, but the
> server ignores all of it and re-derives identity and role on every call.

---

## Identity: who are you?

Identity resolution lives in `Auth.gs`:

1. `getActiveEmail_()` reads `Session.getActiveUser().getEmail()` (returns `''` if
   unavailable).
2. `findUserByEmail_(email)` matches that address — **case-insensitively** — against the
   `Users` tab, accepting only rows where `active` is truthy.
3. `getCurrentUserContext()` assembles the **user context** from the matched row:

   ```
   { email, userId, role, displayName, bufferMin, recurrenceMode, authorized }
   ```

   If no active row matches, it returns the same shape with `authorized: false` and
   `role: null`.

The roster (`Users` tab) is therefore the **source of truth for access**. An email that is
not present, or whose row is inactive, has no access. See [[Data Model]] for the full Users
schema.

---

## The three guards

Every mutating or per-person server function begins by calling one of three guards in
`Auth.gs`. Each re-derives the context from the session, so the client cannot forge its way
past them.

| Guard | Requirement | Throws when |
|---|---|---|
| `requireAuthorized()` | Caller is on the roster (any role) | Email not on an active roster row |
| `requireManager()` | Caller's `role === 'manager'` | Not authorized, or not a manager |
| `requireSelfOrManager(targetUserId)` | Caller is the manager **or** is the employee whose `userId` matches `targetUserId` | Neither the manager nor that employee |

Roles are the two constants in `Schema.gs`: `ROLES = { EMPLOYEE: 'employee', MANAGER:
'manager' }`.

### Where each guard is used

- `requireManager()` — manager-only actions: booking meetings, company-wide closures, team
  management, reports. See [[Manager Guide]] and [[Booking and Concurrency]].
- `requireSelfOrManager(userId)` — per-employee reads and writes so staff can only touch
  their own data: e.g. `getMyUpcomingBookings(userId)`, reschedule and cancel
  (`requireSelfOrManager(String(existing.userId))`), and availability edits. A manager
  passes the check for anyone; an employee passes only for their own `userId`. See
  [[Employee Guide]] and the [[Availability Engine]].
- `requireAuthorized()` — anything any rostered user may do where ownership is not the
  question.

> The `doGet` router and the `getServerInfo` probe call `getCurrentUserContext()` directly
> (not a guard) because they must render a friendly "no access" notice rather than throw —
> but they still never trust client-supplied identity.

---

## What each role can do and see

| | Employee | Manager | Client (booking subject) |
|---|---|---|---|
| Sign in to the app | Yes (lands on employee view) | Yes (lands on manager view) | **No** — never logs in |
| See own calendar / availability | Yes | Yes (and everyone's) | No |
| Edit own availability / time off | Yes | Yes (for anyone) | No |
| Book / reschedule / cancel meetings | Own meetings | Anyone's | No |
| Manage roster, closures, reports | No | Yes | No |

**Clients** are people a meeting is *with*. They are not Workspace users and have no
account or login — their name, email, and phone live only on the booking row (see
[[Data Model]]). Their only touchpoint is the email notifications they receive
(see [[Notifications]]).

### Routing for unrecognised states

`doGet` in `Code.gs` chooses the view from the context and degrades gracefully:

| Situation | Result |
|---|---|
| Roster unreadable (system not yet `setup()`) | **"Setup required"** notice |
| Signed-in account not on the roster | **"No access"** notice naming the email |
| Recognised manager | Manager view |
| Recognised employee | Employee view |

See [[Getting Started]] and [[Troubleshooting]] for what users do when they hit a notice.

---

## OAuth scopes

The app requests exactly four scopes in `appsscript.json` — no more than it needs. Only the
**owner** consents to these (once), because the app executes as the owner.

| Scope | Why it is needed |
|---|---|
| `.../auth/spreadsheets` | Read and write the booking spreadsheet (Users, Bookings, availability tabs, AuditLog, Config) — the entire datastore. |
| `.../auth/script.send_mail` | Send booking confirmation / reschedule / cancellation and reminder emails (see [[Notifications]]). |
| `.../auth/userinfo.email` | Resolve the visitor's email via `Session.getActiveUser()` — the basis of all identity and role checks. |
| `.../auth/script.scriptapp` | Manage the script's own triggers (e.g. the reminder job) via `ScriptApp`. |

Other settings in the same file: `timeZone: Europe/London`, `runtimeVersion: V8`, and
`exceptionLogging: STACKDRIVER`. See [[Configuration]] and [[Deployment]] for the full
manifest context.

---

## The append-only audit log

`AuditLog.gs` records **every mutating action** to the `AuditLog` tab (`SHEETS.AUDIT =
'AuditLog'`). Rows are **never edited or deleted** — `logAudit(e)` only ever appends, via
`appendObject`, and stamps a fresh `auditId` (a UUID) on each entry.

Each entry captures who did what, when, and a JSON before/after snapshot:

| Field | Meaning |
|---|---|
| `auditId` | Unique id for the entry |
| `entityType`, `entityId` | What was changed (e.g. a booking) and its id |
| `action` | `BOOK`, `RESCHEDULE`, `CANCEL`, etc. |
| `actorUserId`, `actorEmail` | **The re-derived caller** from the user context — not anything the client claimed |
| `atMs` | Timestamp (epoch ms) |
| `reason` | Optional note (e.g. a cancellation reason) |
| `beforeJson`, `afterJson` | JSON snapshots of state before/after |

`getAuditFor(entityId)` returns one entity's history newest-first, so a manager can
reconstruct a booking's whole life without re-joining other tabs. Because the actor is
always the server-resolved identity, the log is a trustworthy accountability trail. See
[[Booking and Concurrency]] for how booking flows call `logAudit`.

---

## Data privacy

- **Client contact details** (name, email, phone) are stored only on the relevant booking
  row in the spreadsheet, and surfaced to the employee/manager who handle that meeting.
  Treat the spreadsheet as the system of record for personal data.
- **Spreadsheet ownership** stays with the deploying owner. Do **not** widen sharing on the
  underlying Sheet to give people access — that would bypass the role model entirely. Access
  is granted by adding a row to the `Users` tab, never by Sheet sharing.
- **Bootstrap injection** is escaped: `doGet` escapes every `<` in the bootstrap JSON via
  `replace(/</g, '\\u003c')` so it cannot break out of the page `<script>`.

---

## Practical guidance

- **Keep the roster accurate.** Access *is* the `Users` tab. Add people with
  `addEmployee(email, displayName, opts)` (run from the Apps Script editor); the very first
  manager is seeded automatically by `setup()` as the user who runs it
  (`seedManager_`). New users default to `role: 'employee'` and `active: true`.
- **Deactivate leavers.** When someone leaves, set their `Users` row `active` to false rather
  than deleting it. They immediately fall through to the "No access" notice on their next
  visit, while their historical bookings and audit trail remain intact. (Inactive employees
  are also rejected by booking validation: *"Unknown or inactive employee."*)
- **Promote carefully.** Manager rights are decided solely by the `role` cell. Only set
  `manager` for people who should see and act on everyone's calendar.
- **Match emails exactly to the Workspace login.** Matching is case-insensitive, but it must
  be the address Google returns for that person, or they will not be recognised.

---

See also: [[Home]] · [[Architecture]] · [[Developer Guide]] · [[API Reference]] ·
[[Testing]]
