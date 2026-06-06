# FSW Booking System — Phase 0: Foundation

**Document version:** 1.0
**Date:** 2026-06-06
**Phase status:** Complete
**Audience:** Project owner / reviewer (and future developers)

---

## 1. Purpose of this document

This is the design-and-build record for **Phase 0 (Foundation)** of the FSW Booking System. It explains
*what* was built, *why* each decision was made, and *how* to set up and verify it. It is written to be read
on its own, months from now, without needing the original conversation. Each subsequent phase will have its
own equivalent document.

---

## 2. System overview

FSW is a ~10-person business that currently arranges client meetings informally over email and phone. The
goal is a single, reliable, no-extra-cost place to manage all client scheduling, built entirely inside the
company's existing **Google Workspace**.

There are exactly two kinds of user:

- **Employees (~10)** — each maintains their *own* availability: the times they are free to take clients.
- **The manager** — sees everyone's availability in one combined view and books client meetings into it.

**Clients never log in.** They contact the business as they do today; the manager records the client's
details and assigns the meeting. This keeps the system entirely internal — no public booking page, no client
accounts.

> The booking model is therefore *manager-assigns-everything*. An earlier idea of clients self-booking was
> deliberately dropped after discussion, which simplified the whole design.

---

## 3. Architecture and key decisions

### 3.1 Technology stack

| Layer | Choice | Why |
|---|---|---|
| Application | **Google Apps Script** web app | Runs inside Google Workspace, zero hosting cost, employees auto-authenticate with their work Google accounts |
| Data store | **Google Sheets** | No database to run; data is visible/editable by the owner; trivial backups and exports |
| Front end | HTML served by Apps Script + **FullCalendar** (later phase) | A real calendar UI without a build pipeline |
| Surfacing | Embedded in **Google Sites** (later phase) | The company intranet already lives there |
| Source control | This **git** repo, synced with **clasp** | Code is versioned and reviewable, not trapped in the online editor |

### 3.2 Decisions that are expensive to change later (locked now)

These were chosen deliberately at the foundation because reversing them later would mean a data migration:

1. **All instants are stored as UTC epoch-millisecond integers**, not as text like "2026-06-09 14:00".
   Wall-clock strings corrupt across daylight-saving boundaries and across timezone mismatches. A single
   business timezone is held in `Config.timeZone`, and recurring rules are resolved against it. *(See §6.)*
2. **Availability is computed on the fly, never stored as fixed slots.** The only persisted facts are
   recurring rules, one-off additions, exceptions, time off, closures, and bookings. Free time is *derived*
   by interval subtraction every time it's needed. A direct benefit: cancelling or rescheduling a meeting
   reopens its time automatically, because the engine simply stops subtracting it. *(See §7.)*
3. **UUID primary keys**, with other tabs referencing those IDs (never names or emails, which can change).
4. **The audit log is append-only and bookings are never hard-deleted** (cancel = a status change). History
   is preserved for accountability and reporting.
5. **Buffers are snapshotted onto each booking.** If an employee later changes their buffer, existing
   bookings keep the gap they were made with — no retroactive "phantom" clashes.
6. **Half-open intervals `[start, end)`** are used everywhere, so a meeting ending at 14:00 and one starting
   at 14:00 do not count as overlapping (before buffers are applied).

### 3.3 Deployment model (planned, applied in Phase 8)

The app will be deployed as **Execute as: Me (owner)** with **access: Anyone within the domain**. Because all
users share the Workspace domain, the app can still identify each visitor (`Session.getActiveUser()`), there
is only a one-time owner authorization rather than a prompt for every employee, the data Sheet is never
shared with 10 people, and — critically — it embeds cleanly inside the Google Sites iframe. Booking writes
will be serialized with `LockService` so two people can never double-book the same slot.

---

## 4. Data model

One Google Spreadsheet holds one tab per entity. Every tab has a bold, frozen header row using exactly the
column names below. ID and phone columns are forced to plain-text format; epoch-millisecond columns are
forced to integer format — so Google Sheets never silently reinterprets them as dates or numbers.

| Tab | Holds | Key columns |
|---|---|---|
| **Config** | Editable business settings | `key`, `value` |
| **Users** | Employees + manager | `userId`, `email`, `role`, `bufferMin`, `recurrenceMode`, `active` |
| **AvailabilityRules** | Recurring availability patterns | `freq` (WEEKLY/MONTHLY), day fields, `startTimeLocal`/`endTimeLocal`, effective window |
| **AvailabilityAdditions** | One-off extra free time | `startMs`, `endMs` |
| **AvailabilityExceptions** | "Remove my normal availability here" | `startMs`, `endMs` |
| **TimeOff** | Individual unavailability | `scope` (FULL_DAY/PARTIAL), `startMs`, `endMs`, `reason` |
| **Closures** | Company-wide closures (block everyone) | `startMs`, `endMs`, `reason` |
| **Bookings** | Confirmed/cancelled meetings | client fields, `startMs`/`endMs`, buffer snapshot, `status`, `flag` |
| **AuditLog** | Append-only history | `action`, `actorEmail`, `atMs`, `beforeJson`, `afterJson` |

**Why exceptions and time off are separate:** an *exception* is an employee editing their own recurring
pattern ("I'm normally free Mondays, but not this one") — it can never sit over a booking. *Time off* is a
positive "I am unavailable" that *can* land over an existing booking and must flag it. Different meaning,
different tab, simpler logic. **Closures** are time off applied to everyone at once, so the manager edits one
row instead of ten.

The booking `status` (CONFIRMED / CANCELLED) and `flag` (NONE / TIMEOFF_CONFLICT) are deliberately separate
fields, so a meeting can be simultaneously *confirmed* and *flagged* for a time-off conflict that the manager
still needs to resolve.

---

## 5. Module reference

All code lives in `src/` as Apps Script files. Phase 0 delivered the backend foundation; the UI and the
booking/notification APIs arrive in later phases.

| File | Responsibility |
|---|---|
| **Schema.gs** | Single source of truth: tab names, column order per tab, column-format hints, all enums, primary-key map, time constants. Everything else imports from here. |
| **Config.gs** | Reads the `SHEET_ID` script property and the editable `Config` tab; merges over sensible `DEFAULTS`; exposes `getConfig(key)` and `getTz()`. |
| **TimeUtil.gs** | DST-safe conversion between wall-clock and epoch-ms, local calendar maths (day-of-week, nth-weekday, iterate days). *The most correctness-critical module.* |
| **SheetDAL.gs** | The only place that touches the Sheet: bulk reads, append, update-by-id, short-lived caching, and `withScriptLock` (the concurrency guard). Knows no business rules. |
| **AuditLog.gs** | `logAudit(...)` appends an immutable history row; `getAuditFor(id)` reads an entity's history. |
| **AvailabilityEngine.gs** | The interval algebra and `computeFreeRanges` — derives bookable time. Split into a **pure** function (no Sheet access, fully testable) and a thin loader. |
| **Setup.gs** | `setup()` bootstraps the spreadsheet, tabs, formats, and seeds Config + the first manager. `addEmployee(...)` adds people. Safe to re-run. |
| **Tests.gs** | `runAllTests()` — ten pure unit tests covering the engine and timezone logic. |

Supporting files: `appsscript.json` (manifest: timezone, V8 runtime, web-app + OAuth scope settings),
`package.json` (clasp scripts), `.claspignore` (push only `src/`), `README.md` (setup recipe).

---

## 6. How time is handled (the correctness foundation)

A scheduling system lives or dies on timezone correctness. The approach:

- **Canonical truth is UTC epoch-milliseconds.** Every stored instant is a plain integer.
- **One business timezone** (`Config.timeZone`, default `Europe/London`). Recurring rules are written as
  wall-clock — e.g. "09:00–12:00 every Tuesday" — and resolved to epoch-ms *in that zone, for that specific
  date*. So an "09:00 Monday" block is 09:00 local whether or not the clocks have changed.
- **All conversion goes through `TimeUtil.gs`.** Nothing else builds dates from wall-clock parts. The helper
  measures the zone's UTC offset at a given instant (via `Utilities.formatDate`) and inverts it, iterating
  once to settle correctly across a daylight-saving transition.

Worked example (verified by the test suite):
- `09:00` London on **12 Jan 2026** (winter, GMT) → `09:00` UTC.
- `09:00` London on **13 Jul 2026** (summer, BST) → `08:00` UTC.

Both are computed from the same code path; the one-hour difference is exactly the DST offset, handled
automatically.

---

## 7. The availability algorithm

`computeFreeRanges(userId, windowStart, windowEnd)` answers "when is this employee bookable in this window?"
It is the engine the manager's calendar will be built on. The logic:

1. **Build base availability** = expand the employee's recurring rules across the window, then add any
   one-off additions. Merge overlaps.
2. **Build the blocked set** = the employee's exceptions + their time off + company-wide closures + each
   confirmed booking *extended by its buffer on both sides*.
3. **Free = base − blocked** (interval subtraction). The result is a sorted, non-overlapping list of
   bookable ranges.

Because cancelled bookings are skipped in step 2, cancelling a meeting reopens its time with no extra work.
Because buffers are part of the blocked set, a booking automatically reserves breathing room around itself.

**Recurrence** supports weekly (e.g. every Tuesday) and monthly in two flavours: by day-of-month (e.g. the
15th) and by nth-weekday (e.g. the 2nd Tuesday, or the last Friday). Impossible dates (the 31st in February,
a 5th Tuesday that doesn't exist) are simply skipped.

The engine is split so that the heavy logic — `computeFreeRangesFromData(...)` — is a **pure function**: give
it data and a timezone, get back free ranges, with no Google dependency. That is what makes it unit-testable.

---

## 8. Setup and configuration

Full step-by-step instructions are in `README.md`. In summary:

1. Install Node + clasp, enable the Apps Script API, `clasp login` as the owner account.
2. `clasp create --type webapp --title "FSW Booking" --rootDir src`, then `clasp push`.
3. In the editor, run **`setup()`** once and approve the scopes. This creates the data spreadsheet, builds
   every tab, seeds the `Config` defaults, and registers you as the first manager.
4. Add staff with `addEmployee('name@domain', 'Full Name')`.

**Configurable settings** (the `Config` tab) include: `timeZone`, `defaultBufferMin`, `bookingHorizonDays`,
`reminderLeadHours` (default 24), plus cache/lock tuning. Changing the timezone requires updating the
`Config` row, the script manifest, and the spreadsheet's own timezone so all three agree.

---

## 9. Verification

Run **`runAllTests()`** in the Apps Script editor; expect `10/10 passed`. The suite is pure (no spreadsheet
required) and covers:

| Test | What it proves |
|---|---|
| `mergeIntervals`, `subtractIntervals` | The interval algebra (the engine's backbone) is correct, including touching boundaries |
| `dstWinterVsSummerOffset` | Wall-clock → epoch is correct on both sides of a DST change |
| `localPartsRoundTrip` | Epoch → local calendar parts is consistent |
| `expandRuleWeekly` | Weekly recurrence lands on the right day/time |
| `expandRuleMonthlyDom` | Monthly "by date" recurrence works |
| `expandRuleMonthlyNthDow` | Monthly "nth weekday" recurrence works |
| `freeRangesBookingBuffer` | A booking carves itself + its buffer out of availability |
| `freeRangesTimeOffAndClosure` | Time off and company closures remove availability |
| `freeRangesCancelledBookingReopens` | A cancelled booking does **not** block time |

> Note: the build machine has no JavaScript runtime, and the timezone logic depends on Google's `Utilities`
> service, so the tests are designed to run inside Apps Script. Each test was additionally hand-traced
> against the implementation.

---

## 10. Known limits and risks (carried into later phases)

- **Concurrency:** the double-booking guard (`LockService`) is in place in the data layer and will wrap the
  booking write-path in Phase 4.
- **Sheet growth:** reads are done in bulk (one read per tab) and cached briefly. If bookings accumulate over
  years, an archive step will keep the hot data small (future enhancement).
- **Email quota / iframe embedding:** relevant to later phases; mitigations are documented in the plan and
  will be applied in Phases 6 and 8.

---

## 11. What's next

| Phase | Deliverable |
|---|---|
| **1** | Authentication + app shell: role-based routing (employee vs manager views), iframe-safe rendering |
| 2 | Employee availability screen (recurring + one-off + exceptions + personal buffer) |
| 3 | Time off and company-wide closures, with warn-and-flag for affected bookings |
| 4 | Manager booking: combined calendar, validation, double-booking lock |
| 5 | Reschedule and cancel, with the full audit trail surfaced |
| 6 | Email notifications + the 24-hour reminder |
| 7 | Reporting dashboard (hours, utilisation, by meeting type) |
| 8 | Deployment + Google Sites embedding + user acceptance testing |

Each phase will ship with its own `.md` and `.docx` document like this one.
