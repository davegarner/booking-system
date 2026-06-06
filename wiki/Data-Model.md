# Data Model

The FSW Booking System stores all data in **one Google Spreadsheet, with one tab per entity**. The single source of truth for every tab name, column order, and enum is [`src/Schema.gs`](../blob/main/src/Schema.gs); the data access layer (`SheetDAL.gs`, see the [[Developer Guide]]) writes rows in the column order defined there and reads by mapping the live header row back to these names, so manually reordering columns in the Sheet will not break the app.

This page documents every tab and column exactly as defined in `Schema.gs`. See [[Architecture]] for how the pieces fit together, [[Availability Engine]] for how this data is consumed, and [[Configuration]] for the `Config` tab settings.

## Conventions

These conventions apply across the whole schema and are locked-in foundation decisions (reversing them later would require a data migration):

| Convention | Detail |
|---|---|
| **Epoch-ms integers** | Every instant is stored as a **UTC epoch-millisecond integer** in a column whose name ends in `Ms` (e.g. `startMs`, `createdAtMs`). Wall-clock strings are never stored as instants, because they corrupt across daylight-saving boundaries and timezone mismatches. Conversion to/from local time goes through `TimeUtil.gs` against the single business timezone in `Config.timeZone`. |
| **UUID primary keys** | Every row's ID is a UUID string (`Utilities.getUuid()`). Other tabs reference these IDs (never names or emails, which can change). The PK column for each tab is mapped in `PK` and used by `SheetDAL.updateById`. |
| **Half-open intervals** | All intervals are `[startMs, endMs)` — start inclusive, end exclusive. A meeting ending at 14:00 and one starting at 14:00 do **not** overlap (before buffers are applied). |
| **Soft delete via `active`** | `active` is a real boolean. Cancel / soft-delete sets it `false`; rows are kept, never hard-deleted. Bookings additionally carry a `status` field (see below). |
| **Column formats forced** | `Setup.gs` forces ID, phone, and time-string columns to plain-text (`@`) and epoch-ms / integer columns to integer (`0`), so Sheets never silently reinterprets them as dates or scientific numbers. |

### Why exceptions, time off, and closures are separate tabs

- An **exception** is an employee editing their *own recurring pattern* ("I'm normally free Mondays, but not this one"). It can never sit over a booking.
- **Time off** is a positive "I am unavailable." It *can* land over an existing booking and must flag it.
- **Closures** are time off applied to everyone at once — the manager edits one row instead of ten.

Different meaning, different tab, simpler logic.

### Status vs. flag separation (Bookings)

A booking's `status` (`CONFIRMED` / `CANCELLED`) and `flag` (`NONE` / `TIMEOFF_CONFLICT`) are deliberately **separate fields**, so a meeting can be simultaneously *confirmed* and *flagged* for a time-off conflict the manager still needs to resolve. See [[Booking and Concurrency]].

### Buffer snapshot on bookings

Buffers are **snapshotted onto each booking** (`bufferBeforeMin`, `bufferAfterMin`) at booking time. If an employee later changes their `bufferMin`, existing bookings keep the gap they were made with — no retroactive "phantom" clashes.

---

## Config

Editable business settings as simple key/value rows. See [[Configuration]] for the recognised keys (e.g. `timeZone`, `defaultBufferMin`, `bookingHorizonDays`, `reminderLeadHours`).

| Column | Meaning | Type |
|---|---|---|
| `key` | Setting name | text |
| `value` | Setting value | text |

---

## Users

Employees and the manager. One row per person. See [[Employee Guide]] and [[Manager Guide]].

| Column | Meaning | Type |
|---|---|---|
| `userId` | Primary key (UUID) | text (PK) |
| `email` | Work Google account email | text |
| `displayName` | Human-readable name | text |
| `role` | `employee` or `manager` | enum (text) |
| `bufferMin` | This person's current buffer in minutes (snapshotted onto new bookings) | int |
| `recurrenceMode` | The user's recurrence preference | text |
| `active` | Soft-delete flag | boolean |
| `colorHex` | Calendar display colour | text |

**`role` enum** (`ROLES`): `employee`, `manager`.

---

## AvailabilityRules

Recurring availability patterns ("the times I'm free, every week/month"). Expanded across a window by the [[Availability Engine]].

| Column | Meaning | Type |
|---|---|---|
| `ruleId` | Primary key (UUID) | text (PK) |
| `userId` | Owning user (FK to Users) | text |
| `freq` | `WEEKLY` or `MONTHLY` | enum (text) |
| `dayOfWeek` | WEEKLY: `0`=Mon .. `6`=Sun | int |
| `monthlyMode` | MONTHLY: `DOM` or `NTH_DOW` | enum (text) |
| `dayOfMonth` | MONTHLY/DOM: day number (e.g. 15) | int |
| `nth` | MONTHLY/NTH_DOW: ordinal; `-1` => last | int |
| `nthDayOfWeek` | MONTHLY/NTH_DOW: which weekday (0=Mon..6=Sun) | int |
| `startTimeLocal` | Wall-clock start `"HH:mm"` in business tz | text |
| `endTimeLocal` | Wall-clock end `"HH:mm"` in business tz | text |
| `effectiveFromMs` | Active-window start (epoch-ms, inclusive) | int |
| `effectiveToMs` | Active-window end (epoch-ms, inclusive). Empty = open-ended | int |
| `active` | Soft-delete flag | boolean |

**`freq` enum** (`FREQ`): `WEEKLY`, `MONTHLY`.
**`monthlyMode` enum** (`MONTHLY_MODE`): `DOM` (by day-of-month, e.g. the 15th), `NTH_DOW` (by nth weekday, e.g. the 2nd Tuesday; `nth = -1` means the last).

> Note the two distinct conventions: recurring times are stored as **wall-clock strings** (`startTimeLocal` / `endTimeLocal`) resolved against the business timezone for each specific date, while the rule's active window (`effectiveFromMs` / `effectiveToMs`) is stored as epoch-ms.

---

## AvailabilityAdditions

One-off *extra* free time outside the recurring pattern. Added to base availability.

| Column | Meaning | Type |
|---|---|---|
| `additionId` | Primary key (UUID) | text (PK) |
| `userId` | Owning user (FK to Users) | text |
| `startMs` | Interval start (epoch-ms, inclusive) | int |
| `endMs` | Interval end (epoch-ms, exclusive) | int |
| `note` | Optional note | text |
| `active` | Soft-delete flag | boolean |

---

## AvailabilityExceptions

"Remove my normal availability here" — an employee carving a hole out of their *own* recurring pattern. Subtracted from base availability; can never sit over a booking.

| Column | Meaning | Type |
|---|---|---|
| `exceptionId` | Primary key (UUID) | text (PK) |
| `userId` | Owning user (FK to Users) | text |
| `startMs` | Interval start (epoch-ms, inclusive) | int |
| `endMs` | Interval end (epoch-ms, exclusive) | int |
| `note` | Optional note | text |
| `active` | Soft-delete flag | boolean |

---

## TimeOff

Individual unavailability ("I am off"). A positive block that *can* overlap an existing booking and flag it.

| Column | Meaning | Type |
|---|---|---|
| `timeOffId` | Primary key (UUID) | text (PK) |
| `userId` | Affected user (FK to Users) | text |
| `scope` | `FULL_DAY` or `PARTIAL` | enum (text) |
| `startMs` | Interval start (epoch-ms, inclusive) | int |
| `endMs` | Interval end (epoch-ms, exclusive) | int |
| `reason` | Reason for the time off | text |
| `createdBy` | userId of the creator | text |
| `createdAtMs` | When created (epoch-ms) | int |
| `active` | Soft-delete flag | boolean |

**`scope` enum** (`TIMEOFF_SCOPE`): `FULL_DAY`, `PARTIAL`.

---

## Closures

Company-wide closures that block **everyone** at once. Same shape as TimeOff but with no `userId` — applied across all employees.

| Column | Meaning | Type |
|---|---|---|
| `closureId` | Primary key (UUID) | text (PK) |
| `scope` | Closure scope (`FULL_DAY` / `PARTIAL`) | enum (text) |
| `startMs` | Interval start (epoch-ms, inclusive) | int |
| `endMs` | Interval end (epoch-ms, exclusive) | int |
| `reason` | Reason for the closure | text |
| `createdBy` | userId of the creator | text |
| `createdAtMs` | When created (epoch-ms) | int |
| `active` | Soft-delete flag | boolean |

---

## Bookings

Confirmed and cancelled client meetings. The manager records the client's details and assigns the meeting; clients never log in. See [[Booking and Concurrency]] and [[Notifications]].

| Column | Meaning | Type |
|---|---|---|
| `bookingId` | Primary key (UUID) | text (PK) |
| `userId` | Assigned employee (FK to Users) | text |
| `clientName` | Client's name | text |
| `clientEmail` | Client's email | text |
| `clientPhone` | Client's phone | text |
| `purposeNotes` | Purpose / notes for the meeting | text |
| `locationFormat` | `IN_PERSON`, `PHONE`, or `VIDEO` | enum (text) |
| `meetingType` | Type/category of meeting | text |
| `startMs` | Meeting start (epoch-ms, inclusive) | int |
| `endMs` | Meeting end (epoch-ms, exclusive) | int |
| `bufferBeforeMin` | Buffer minutes before (snapshot at booking time) | int |
| `bufferAfterMin` | Buffer minutes after (snapshot at booking time) | int |
| `status` | `CONFIRMED` or `CANCELLED` | enum (text) |
| `flag` | `NONE` or `TIMEOFF_CONFLICT` | enum (text) |
| `flagReason` | Explanation when flagged | text |
| `reminderSent` | Whether the reminder email was sent | boolean |
| `reminderSentAt` | When the reminder was sent (epoch-ms) | int |
| `createdBy` | userId of the creator | text |
| `createdAtMs` | When created (epoch-ms) | int |
| `updatedBy` | userId of the last editor | text |
| `updatedAtMs` | When last updated (epoch-ms) | int |
| `cancelReason` | Reason recorded on cancellation | text |

**`locationFormat` enum** (`LOCATION_FORMAT`): `IN_PERSON`, `PHONE`, `VIDEO`.
**`status` enum** (`BOOKING_STATUS`): `CONFIRMED`, `CANCELLED`.
**`flag` enum** (`BOOKING_FLAG`): `NONE`, `TIMEOFF_CONFLICT`.

> Cancelling sets `status = CANCELLED` (a status change, not a deletion). The [[Availability Engine]] only subtracts confirmed bookings, so a cancelled booking automatically reopens its time.

---

## AuditLog

Append-only history. Every meaningful change writes one immutable row via `AuditLog.logAudit(...)`; `getAuditFor(id)` reads an entity's history. Rows are never updated or deleted.

| Column | Meaning | Type |
|---|---|---|
| `auditId` | Primary key (UUID) | text (PK) |
| `entityType` | Which kind of entity changed | enum (text) |
| `entityId` | The changed entity's ID | text |
| `action` | What happened | enum (text) |
| `actorUserId` | userId of who acted | text |
| `actorEmail` | Email of who acted | text |
| `atMs` | When it happened (epoch-ms) | int |
| `reason` | Reason / note for the change | text |
| `beforeJson` | JSON snapshot of the row before the change | text (JSON) |
| `afterJson` | JSON snapshot of the row after the change | text (JSON) |

**`action` enum** (`AUDIT_ACTION`): `BOOK`, `RESCHEDULE`, `CANCEL`, `FLAG`, `UNFLAG`, `CREATE`, `UPDATE`, `DELETE`.
**`entityType` enum** (`ENTITY`): `BOOKING`, `TIMEOFF`, `CLOSURE`, `RULE`, `ADDITION`, `EXCEPTION`, `USER`.

---

## Time constants

`Schema.gs` also exports helper constants used across the codebase:

```js
MS_PER_MIN  = 60 * 1000;
MS_PER_HOUR = 60 * MS_PER_MIN;
MS_PER_DAY  = 24 * MS_PER_HOUR;
```

## See also

- [[Architecture]] — how the tabs, DAL, and engine fit together
- [[Availability Engine]] — how this data becomes bookable free ranges
- [[Booking and Concurrency]] — booking writes, status/flag, locking
- [[Configuration]] — the `Config` tab settings
- [[Developer Guide]] / [[API Reference]] — working with the schema in code
