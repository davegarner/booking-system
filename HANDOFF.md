# FSW Booking System — Project Handoff

> **Purpose of this document:** everything a new owner, developer, or operator needs to take
> over the FSW Booking System — what it is, where it lives, what is done, what is still
> outstanding, and exactly how to stand it up and run it.
>
> **Status at handoff:** v1 feature-complete. All 8 build phases are coded and documented.
> No code has ever been executed in any environment yet — Google Apps Script only runs inside
> Google, so the **first real run is the new owner's responsibility** (see
> [§6 Outstanding actions](#6-outstanding-actions-owner-to-do)).
>
> _Last updated: 2026-06-07._

---

## 1. What this is

An **internal client-booking system** for a ~10-person team. Employees set their own
availability; the **manager** records clients and books client meetings into employees'
free time. Clients never log in.

It is built **entirely inside Google Workspace** — no third-party services:

| Layer | Technology |
|---|---|
| App logic + UI | **Google Apps Script** web app (V8 runtime, `.gs` + templated `.html`) |
| Datastore | **Google Sheets** (one spreadsheet, nine tabs) |
| Hosting / front door | Embedded in a **Google Site** via an `/exec` iframe |
| Email | `MailApp` (sends as the project owner) |
| Source control | **git** + **clasp** (push/pull `.gs`/`.html` to the script project) |

**Design philosophy:** greenfield, zero external dependencies, owner-runs-everything, data
stays private to the owner's Workspace account.

---

## 2. Current state — v1 complete

All eight phases are built, each with a comprehensive write-up (`.md` + `.docx`) in `docs/`.

| Phase | Area | Key modules |
|---|---|---|
| 0 | Foundation | `Schema.gs`, `Config.gs`, `TimeUtil.gs`, `SheetDAL.gs`, `AuditLog.gs`, `AvailabilityEngine.gs`, `Setup.gs`, `Tests.gs` |
| 1 | Auth & app shell | `Auth.gs`, `Code.gs`, `ui/Index.html`, `Styles.html`, `JsCommon.html`, `Notice.html` |
| 2 | Employee availability | `AvailabilityApi.gs`, `ui/Employee.html`, `JsEmployee.html` |
| 3 | Time off & closures | `TimeOffApi.gs`, `ui/Manager.html`, `JsManager.html` |
| 4 | Manager booking | `BookingApi.gs` (FullCalendar schedule + book flow) |
| 5 | Reschedule & cancel | `BookingApi.gs` (+ employee "My calendar") |
| 6 | Notifications & reminders | `Notifications.gs`, `Reminders.gs`, `Triggers.gs` |
| 7 | Reporting dashboard | `Reporting.gs` (Manager "Reports" tab) |
| 8 | Deploy + Sites embed + UAT | README deploy recipe, roster "Team" tab, `docs/Phase-8-Deployment.md` |

**Inventory:** 17 `.gs` files + 8 `ui/*.html` files. `runAllTests()` covers **13 unit tests**
(timezone conversions + availability engine + booking validation), all pure / in-memory.

Consistency has been verified statically (balanced braces, no duplicate globals, all client
`google.script.run` targets resolve, balanced `<script>` tags) — but **not run**.

---

## 3. Where everything lives

### Source repository
- **GitHub (primary, public-ish):** <https://github.com/davegarner/booking-system>
  `main` is **in sync** with local (`8e71aa1`), full phase history present.
- **Gitea (origin remote):** `http://gitea.uk.local:3000/david/FSW-Booking-System.git`
  This is the configured `origin`. GitHub was added/pushed separately.
- **Local working copy:** `/Users/david/Repo/FSW-Booking-System`

> ⚠️ Note: `git remote -v` shows **only Gitea as `origin`**. The GitHub push history was done
> out-of-band. If you want `git push` to update GitHub too, add it as a remote:
> ```bash
> git remote add github https://github.com/davegarner/booking-system.git
> git push github main
> ```

### Wiki
- **GitHub Wiki:** <https://github.com/davegarner/booking-system/wiki> — a **separate git repo**
  (`booking-system.wiki.git`). Source pages live in this repo under `wiki/` (19 pages).
- ⏳ **Pending:** as of handoff the GitHub Wiki still shows only the default placeholder page.
  A commit with all 19 pages is prepared and waiting to be pushed — see
  [§6 Outstanding actions](#6-outstanding-actions-owner-to-do).

### Documentation
- `docs/` — nine per-phase write-ups, each in **Markdown + Word** (`.docx`), plus `docs/README.md` index.
- `README.md` — setup + deploy quick-start.
- `wiki/` — 16 topic pages + Home/Sidebar/Footer (the GitHub Wiki source).

---

## 4. Repository layout

```
FSW-Booking-System/
  package.json          # clasp scripts + devDependencies (clasp, GAS types)
  .claspignore          # only src/ is pushed to Apps Script
  .clasp.json.example   # template; real .clasp.json (scriptId) is generated & git-ignored
  .gitignore
  README.md             # setup + deploy quick-start
  HANDOFF.md            # this document
  Prompt - All Phases.md# the original full build prompt/spec (large)
  docs/                 # per-phase docs: Phase-0..8 (.md + .docx) + README.md index
  wiki/                 # GitHub Wiki source — 19 .md pages
  tools/                # md2docx.py + build-docs.sh   (NOT pushed to Apps Script)
  src/                  # everything clasp pushes to the script project
    appsscript.json     #   manifest: timeZone, V8, webapp{access:DOMAIN, executeAs:USER_DEPLOYING}, scopes
    Schema.gs           #   tab/column names + enums (single source of truth)
    Config.gs           #   Script-property SHEET_ID + Config-tab reader
    TimeUtil.gs         #   DST-safe wall-clock <-> UTC-epoch-ms conversion
    SheetDAL.gs         #   bulk read/append/updateById, CacheService, withScriptLock()
    AuditLog.gs         #   logAudit()
    AvailabilityEngine.gs # computeFreeRanges + pure computeFreeRangesFromData + interval algebra
    Setup.gs            #   setup(), addEmployee()
    Tests.gs            #   runAllTests() — 13 pure unit tests, no Sheet needed
    Code.gs             #   doGet() router, include(), getServerInfo()
    Auth.gs             #   identity + requireAuthorized/Manager/SelfOrManager (server-trusted)
    AvailabilityApi.gs  #   employee availability CRUD
    TimeOffApi.gs       #   time off + closures + roster + flagged bookings
    BookingApi.gs       #   validate/create/reschedule/cancel + calendar feed
    Notifications.gs    #   notifyBooking_ (client/employee/manager HTML+text email)
    Reminders.gs        #   sendDueReminders() (hourly 24h reminder)
    Triggers.gs         #   installTriggers()/removeTriggers()
    Reporting.gs        #   getReport(from,to) — utilisation dashboard
    ui/
      Index.html  Styles.html  JsCommon.html  Notice.html
      Employee.html  JsEmployee.html
      Manager.html   JsManager.html
```

---

## 5. Architecture & key design decisions (locked during planning)

These were agreed with the original stakeholder and should not be casually reversed — much of
the code depends on them.

- **Manager-assigns-only.** Clients never authenticate. The manager records the client (name,
  email) and books on an employee's behalf. (An earlier "clients self-book" idea was dropped.)
- **Employee-owned availability.** Each employee sets a recurring pattern (**weekly OR
  monthly**) plus one-off **additions** and **exceptions**, plus a **per-employee buffer**
  (gap enforced around every meeting).
- **One-to-one only.** No overlapping meetings per employee. No daily caps.
- **Free ranges, length-per-booking.** No fixed slot grid. Availability is **computed on the
  fly** by interval subtraction (`computeFreeRangesFromData`), never materialized/stored.
- **Time off & closures warn, never delete.** Employee/manager time off and company-wide
  closures that overlap an existing booking **flag** it (amber ⚠ in the UI) rather than
  cancelling; the manager resolves manually. Every add/delete recomputes flags under a lock.
- **Reschedule re-validates; cancel reopens time + records reason.** Full **audit trail** in
  the `AuditLog` tab.
- **Email-only notifications** (client + employee + manager) on book / reschedule / cancel,
  plus a **24-hour reminder** (managers excluded from reminders to cut noise).
- **v1 includes a reporting dashboard.** Recurring *client* meetings were deferred.

**Technical invariants:**
- **All instants are stored as UTC epoch-millisecond integers.** All recurring/wall-clock
  times are interpreted in **one business timezone** (`Config.timeZone`, default
  `Europe/London`). `TimeUtil.gs` is the only place that converts between the two and is
  DST-safe.
- **Deploy as "Execute as: Me (owner)" + "Who has access: Anyone within domain."** This exact
  combination is required so the Google Sites iframe works **and**
  `Session.getActiveUser().getEmail()` still resolves (same-domain exception) so per-user roles
  work — with only a one-time owner OAuth authorization, keeping the data Sheet private.
- **Booking writes are serialized with `LockService`** (`withScriptLock`) and re-validate
  inside the lock to prevent double-booking races.
- **Server never trusts the client for identity or role.** `Auth.gs` re-derives the caller's
  email/role on every privileged call; a booking ID alone grants no access.

---

## 6. Outstanding actions (owner to-do)

Nothing below can be done from a developer machine without the **owning Google Workspace
account** — Apps Script code only executes inside Google. Do these in order.

### A. Publish the wiki (1 command, pending)
A commit containing all 19 wiki pages is staged in a local clone of the wiki repo at
`/tmp/bswiki` (commit `96c56ae`, "Add full FSW Booking System wiki (19 pages)"). Push it from
a terminal that is authenticated to GitHub:

```bash
cd /tmp/bswiki
git push origin master
```

→ pages go live at <https://github.com/davegarner/booking-system/wiki>.

> If `/tmp/bswiki` has been cleared (it lives in `/tmp`), recreate it:
> ```bash
> git clone https://github.com/davegarner/booking-system.wiki.git /tmp/bswiki
> cp /Users/david/Repo/FSW-Booking-System/wiki/*.md /tmp/bswiki/
> cd /tmp/bswiki && git add -A && git commit -m "Add full FSW Booking System wiki (19 pages)"
> git push origin master
> ```

### B. Stand up the Apps Script project
```bash
npm install                      # installs clasp (devDependency)
npx clasp login                  # sign in as the OWNER account (runs the app, sends all email)
# enable the Apps Script API first: https://script.google.com/home/usersettings  -> On
npx clasp create --type webapp --title "FSW Booking" --rootDir src   # writes .clasp.json
npx clasp push                   # uploads src/ to the script project
```
(If a script already exists: `npx clasp clone <scriptId> --rootDir src` then `clasp push`.)

### C. Initialise data + first manager
1. `npx clasp open` → in the editor select **`setup`** → Run. Approve the OAuth scopes (one-time).
2. `setup()` creates the spreadsheet **"FSW Booking System — Data"**, builds all tabs, seeds
   `Config`, registers you as the first **manager**, and installs the hourly reminder trigger.
   The spreadsheet URL is printed to the execution log (View → Logs).

### D. Add the team
Run in the editor (or `clasp run`):
```js
addEmployee('alex@yourdomain.com', 'Alex Smith');
addEmployee('sam@yourdomain.com',  'Sam Jones', { bufferMin: 30, recurrenceMode: 'MONTHLY' });
// role defaults to 'employee'; pass { role: 'manager' } for another manager
```

### E. Verify
Run **`runAllTests`** in the editor → expect **`13/13 passed`** in the log (pure, no Sheet
needed). Then walk the **30-row UAT matrix** in `docs/Phase-8-Deployment.md`.

### F. Confirm timezone (must match in THREE places)
Default is `Europe/London`. To change, set the same IANA zone in all three:
1. `Config` tab → `timeZone` row, 2. `src/appsscript.json` → `timeZone`, 3. the data
spreadsheet → File → Settings → Time zone.

### G. Deploy & embed
1. **Deploy → New deployment → Web app** (or `clasp deploy`) with **Execute as: Me** +
   **Who has access: Anyone within `<your domain>`**.
2. Copy the **`/exec`** URL (not `/dev`). Re-deploy to the **same deployment** to keep the URL
   stable (`clasp deployments` → `clasp deploy --deploymentId <id>`).
3. In the Google Site: **Insert → Embed → By URL** → paste the `/exec` URL. Publish the Site
   restricted to your Workspace domain.
4. Add a **"Open in new tab"** fallback button (some locked-down browsers block third-party
   iframes; the app already sets `ALLOWALL` + `<base target="_top">`).

---

## 7. Data model (Google Sheet tabs)

Nine tabs, defined authoritatively in `Schema.gs`:

| Tab | Holds |
|---|---|
| `Config` | Key/value settings (timeZone, reminderLeadHours, default buffer, etc.) |
| `Users` | Employees + managers: email, name, role, buffer, recurrence mode, active flag |
| `AvailabilityRules` | Recurring availability patterns (weekly or monthly) |
| `AvailabilityAdditions` | One-off extra available windows |
| `AvailabilityExceptions` | One-off removed windows |
| `TimeOff` | Employee/manager time off (full-day or partial) |
| `Closures` | Company-wide closures (+ `scope` column) |
| `Bookings` | Client meetings: employee, client, start (epoch-ms), length, status, buffer snapshot, flag, reminderSent |
| `AuditLog` | Append-only trail of every privileged mutation |

All timestamps are **UTC epoch-ms integers**; the booking row snapshots the employee's buffer
at booking time so later buffer changes don't retroactively invalidate existing bookings.

---

## 8. Notifications, reminders & triggers

- `Notifications.notifyBooking_(b, kind, extra)` sends tailored **HTML + plain-text** email on
  BOOK / RESCHEDULE / CANCEL to client (replyTo = employee), employee, and managers (managers
  are **skipped on REMINDER** to reduce noise). `sendMail_` is quota-guarded via
  `MailApp.getRemainingDailyQuota()`.
- Booking mutations notify **after** the lock is released, best-effort (`try/catch`) — email
  failure never fails the booking.
- `Reminders.sendDueReminders()` runs **hourly**: confirmed + not-yet-reminded + due within
  `reminderLeadHours` → emails client + employee, sets `reminderSent = true` (dedupe).
- `Triggers.installTriggers()` / `removeTriggers()` manage the hourly trigger (delete-then-
  create). `setup()` installs it automatically.

---

## 9. Testing

`Tests.gs` → `runAllTests()` runs **13 pure unit tests** with in-memory data (no spreadsheet
required): timezone conversions (weekly + monthly), availability engine (recurring expansion,
buffer/time-off/closure subtraction, cancelled-booking reopen), and booking validation. Expect
`13/13 passed` in the execution log.

**Known test gap:** `BookingApi.validateBooking` (Phase 4) is exercised indirectly but does not
yet have dedicated unit cases in `Tests.gs`. Adding them is the top piece of test debt.

There is **no local JS runtime** for this code — GAS-specific globals (`SpreadsheetApp`,
`MailApp`, `LockService`, `Session`) only exist inside Google. Tests must be run in the editor.

---

## 10. Documentation & tooling

- **Per-phase docs:** `docs/Phase-0..8-*.md` + matching `.docx`. The project convention is that
  **every phase ships both Markdown and Word** ("for offline/Word review"). Index in
  `docs/README.md`.
- **Doc build tool:** `tools/build-docs.sh [file.md]` → regenerates `.docx` via
  `tools/md2docx.py` (uses `python-docx` 1.2.0; no pandoc/node required). Handles headings,
  bold, inline code, links, b/numbered lists, GitHub tables, fenced code blocks.
  Tools live **outside `src/`** so clasp never pushes them to Apps Script.
- **Wiki:** 16 topic pages (Architecture, Getting-Started, Employee-Guide, Manager-Guide,
  Data-Model, Availability-Engine, Booking-and-Concurrency, Notifications, Configuration,
  Deployment, Developer-Guide, API-Reference, Testing, Troubleshooting, Security-and-
  Permissions, Roadmap) + Home/_Sidebar/_Footer. Uses GitHub-wiki `[[Title]]` link syntax
  (spaces→hyphens in filenames). All cross-links resolve. The wiki was generated and then
  adversarially audited (5 factual errors found and fixed).

---

## 11. Known gaps, tech debt & deferred features

**Tech debt / gaps:**
- `validateBooking` lacks dedicated unit tests (see §9).
- Code has **never executed** — first run will be the first real validation. Budget time for
  shaking out runtime-only issues (OAuth scopes, trigger install, email quota).
- GitHub is not a configured git remote locally (pushes were out-of-band — see §3).
- The wiki push is still pending (see §6 A).

**Deferred future enhancements (explicitly out of v1 scope):**
- Google Calendar two-way sync
- Recurring **client** meetings (recurring employee availability already exists)
- In-app roster editing (currently `addEmployee()` / Sheet edits; Team tab is read-only)
- Booking archival / data retention policy
- SMS notifications

---

## 12. Quick reference — common commands

```bash
# --- source / docs ---
git push github main                       # push code to GitHub (after adding the remote, §3)
tools/build-docs.sh                        # rebuild all .docx from .md
cd /tmp/bswiki && git push origin master   # publish the wiki (§6 A)

# --- clasp (Apps Script) ---
npx clasp login                            # auth as owner
npx clasp push                             # upload src/ to the script project
npx clasp open                             # open the script editor
npx clasp deploy                           # new web-app deployment
npx clasp deployments                      # list deployments (to pin a stable /exec id)
npx clasp logs                             # tail execution logs

# --- in the Apps Script editor (Run button) ---
setup()           # one-time: build spreadsheet + first manager + triggers
addEmployee(...)  # add a team member
runAllTests()     # expect 13/13 passed
installTriggers() # (re)install the hourly reminder trigger
```

---

## 13. Contacts

- **Owner / original author:** david (`dave.garner@me.com`)
- **Full original spec:** `Prompt - All Phases.md` (repo root)
- **Approved implementation plan:** `/Users/david/.claude/plans/i-want-to-create-sorted-clover.md`
- **Deepest single reference:** `docs/Phase-8-Deployment.md` (deploy + embed + 30-row UAT
  matrix + go-live checklist)
