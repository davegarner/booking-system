# API Reference

This page documents the **client-callable server functions** — the Apps Script
functions the UI invokes from the browser via `google.script.run`. Each one
**re-derives identity on the server** (it never trusts an email, role, or
`userId` sent from the client) and applies a permission guard before doing any
work. See [[Security and Permissions]] for how the guards work, and
[[Architecture]] for how the client/server round-trip fits together.

## Permission guards

All guards live in `Auth.gs` and either return the current user context or
throw. They are described in full in [[Security and Permissions]].

| Guard | Allows | On failure |
| --- | --- | --- |
| `requireAuthorized()` | Any active user on the Users roster | Throws "Not authorized: … not on the FSW Booking roster." |
| `requireManager()` | Authorized users whose role is `MANAGER` | Throws "Not authorized: manager access required." |
| `requireSelfOrManager(targetUserId)` | The manager, or the employee whose `userId` matches `targetUserId` | Throws "Not authorized: you can only act on your own calendar." |

Note: the explicitly-listed functions below either call `requireManager` or
`requireSelfOrManager`. `requireAuthorized` is the base guard the other two call
internally; no top-level API function calls it directly.

Identifiers passed in (`userId`, `ruleId`, `bookingId`, …) are validated against
the data — e.g. a rule/booking must belong to the named user — so a guard pass
alone is not enough to act on someone else's row.

---

## Session / auth

Defined in `Code.gs`.

### `getServerInfo()`
- **Params:** none
- **Guard:** none explicit — calls `getCurrentUserContext()` directly (does not throw for unauthorized callers; returns `authorized:false`)
- **Returns:** `{ email, role, userId, displayName, authorized, tz, serverTimeMs, serverTimeText }`
- Lightweight identity + connectivity probe the shell uses to confirm the client↔server round-trip and show who is signed in.

> The page itself is served by `doGet(e)` (not a `google.script.run` call); it
> picks the manager, employee, or notice view. See [[Architecture]].

---

## Availability

Defined in `AvailabilityApi.gs`. Every entry point is guarded by
`requireSelfOrManager(userId)` so an employee can only touch their own calendar,
while the manager may act for anyone. Wall-clock input is converted to epoch-ms
in the business timezone on the server. See the [[Availability Engine]] for how
these settings become free time, and the [[Employee Guide]] for usage.

### `getEmployeeAvailability(userId)`
- **Params:** `userId`
- **Guard:** `requireSelfOrManager(userId)`
- **Returns:** `{ user, rules, additions, exceptions, tz }`
- Everything the employee availability screen needs in one call.

### `saveRule(userId, rule)`
- **Params:** `userId`, `rule` (omit `rule.ruleId` to create, include it to update)
- **Guard:** `requireSelfOrManager(userId)`
- **Returns:** `ruleId` (string)
- Creates or updates a recurring availability rule (weekly or monthly).

### `deleteRule(userId, ruleId)`
- **Params:** `userId`, `ruleId`
- **Guard:** `requireSelfOrManager(userId)`
- **Returns:** `true`
- Soft-deletes a recurring rule (`active=false`) and audits it.

### `addOneOff(userId, payload)`
- **Params:** `userId`, `payload` `{ date, startTime, endTime, note }`
- **Guard:** `requireSelfOrManager(userId)`
- **Returns:** the new addition id (string)
- Adds a one-off availability slot (extra bookable time).

### `deleteOneOff(userId, additionId)`
- **Params:** `userId`, `additionId`
- **Guard:** `requireSelfOrManager(userId)`
- **Returns:** `true`
- Soft-deletes a one-off availability slot.

### `addException(userId, payload)`
- **Params:** `userId`, `payload` `{ date, startTime, endTime, note }`
- **Guard:** `requireSelfOrManager(userId)`
- **Returns:** the new exception id (string)
- Adds an exception that removes availability from the computed free time.

### `deleteException(userId, exceptionId)`
- **Params:** `userId`, `exceptionId`
- **Guard:** `requireSelfOrManager(userId)`
- **Returns:** `true`
- Soft-deletes an exception.

### `setBuffer(userId, minutes)`
- **Params:** `userId`, `minutes` (0–600)
- **Guard:** `requireSelfOrManager(userId)`
- **Returns:** `true`
- Sets the employee's buffer (gap in minutes between meetings).

### `previewFreeRanges(userId, fromDateStr, toDateStr)`
- **Params:** `userId`, `fromDateStr` `"yyyy-MM-dd"`, `toDateStr` `"yyyy-MM-dd"` (range ≤ ~3 months)
- **Guard:** `requireSelfOrManager(userId)`
- **Returns:** `Array<{ start, end, dayText, startText, endText }>`
- Live preview of computed free ranges so the employee can see the effect of their settings.

---

## Time off & closures

Defined in `TimeOffApi.gs`. Time off and closures **remove** availability; when
they land over a confirmed booking the booking is not deleted but **flagged**
(`TIMEOFF_CONFLICT`) for the manager. Mutations run under the script lock and
recompute flags. See [[Booking and Concurrency]] for the flag model and the
[[Manager Guide]] for handling conflicts.

### `getTimeOff(userId)`
- **Params:** `userId`
- **Guard:** `requireSelfOrManager(userId)`
- **Returns:** `Array<{ timeOffId, scope, reason, text }>` (upcoming, active)
- Lists a user's upcoming, active time off.

### `addTimeOff(userId, payload)`
- **Params:** `userId`, `payload` (full-day `{ scope, startDate, endDate, reason }` or partial `{ scope, date, startTime, endTime, reason }`)
- **Guard:** `requireSelfOrManager(userId)`
- **Returns:** `{ timeOffId, affected:[ { bookingId, employee, clientName, when }, … ] }`
- Adds time off, then recomputes flags and reports any newly-conflicting bookings.

### `deleteTimeOff(userId, timeOffId)`
- **Params:** `userId`, `timeOffId`
- **Guard:** `requireSelfOrManager(userId)`
- **Returns:** `true`
- Soft-deletes time off and recomputes flags for that user.

### `getClosures()`
- **Params:** none
- **Guard:** `requireManager()`
- **Returns:** `Array<{ closureId, reason, text }>` (upcoming, active)
- Lists upcoming company-wide closures.

### `addClosure(payload)`
- **Params:** `payload` (full-day or partial span, same shape as time off, with `reason`)
- **Guard:** `requireManager()`
- **Returns:** `{ closureId, affected:[ { bookingId, employee, clientName, when }, … ] }`
- Adds a company-wide closure for all users, then recomputes flags.

### `deleteClosure(closureId)`
- **Params:** `closureId`
- **Guard:** `requireManager()`
- **Returns:** `true`
- Soft-deletes a closure and recomputes flags for everyone.

### `getRoster()`
- **Params:** none
- **Guard:** `requireManager()`
- **Returns:** `Array<{ userId, displayName, email, role, bufferMin }>` (active, sorted by name)
- Active roster used by manager screens to pick an employee.

### `getFlaggedBookings()`
- **Params:** none
- **Guard:** `requireManager()`
- **Returns:** `Array<{ bookingId, employee, clientName, when, flagReason }>`
- The conflicts list: currently-flagged upcoming confirmed bookings.

---

## Booking

Defined in `BookingApi.gs`. Creation re-validates inside the script lock against
freshly-committed data so two managers can never double-book the same slot — see
[[Booking and Concurrency]]. Booking changes fire best-effort emails via
[[Notifications]].

### `createBooking(payload)`
- **Params:** `payload` `{ userId, date, startTime, lengthMin, clientName, clientEmail, clientPhone, purposeNotes, locationFormat, meetingType }`
- **Guard:** `requireManager()`
- **Returns:** `{ bookingId }`
- Creates a confirmed booking (manager only) with a buffer snapshot, then notifies.

### `getCalendarBookings(fromDateStr, toDateStr)`
- **Params:** `fromDateStr`, `toDateStr` `"yyyy-MM-dd"` (`toDateStr` is **exclusive**, matching FullCalendar)
- **Guard:** `requireManager()`
- **Returns:** `Array` of FullCalendar events `{ id, title, start, end, color, classNames, extendedProps }`
- Confirmed bookings as calendar events for the range.

### `getMyUpcomingBookings(userId)`
- **Params:** `userId`
- **Guard:** `requireSelfOrManager(userId)`
- **Returns:** `Array` of booking detail objects (`bookingId`, `clientName`, `whenText`, `lengthMin`, `flag`, …)
- A user's upcoming confirmed meetings.

### `rescheduleBooking(bookingId, payload)`
- **Params:** `bookingId`, `payload` `{ date, startTime, lengthMin }`
- **Guard:** `requireSelfOrManager(existing.userId)` (resolved from the booking's owner)
- **Returns:** `{ ok: true }`
- Moves a confirmed booking to a new time, re-validating the slot; resets the reminder, re-evaluates the conflict flag, then notifies.

### `cancelBooking(bookingId, reason)`
- **Params:** `bookingId`, `reason` (optional)
- **Guard:** `requireSelfOrManager(existing.userId)` (resolved from the booking's owner)
- **Returns:** `{ ok: true }`
- Cancels a confirmed booking, clears any conflict flag, records the reason, then notifies.

> `validateBooking(userId, startMs, lengthMin, excludeBookingId, opts)` exists in
> `BookingApi.gs` but is an internal helper used by `createBooking` and
> `rescheduleBooking`; it is not called directly from the UI.

---

## Reporting

Defined in `Reporting.gs`. Read-only.

### `getReport(fromDateStr, toDateStr)`
- **Params:** `fromDateStr`, `toDateStr` `"yyyy-MM-dd"` (inclusive; range < ~1 year)
- **Guard:** `requireManager()`
- **Returns:** `{ from, to, rows, totals, byType }` — per-employee offered/booked hours, utilisation, totals, and a company breakdown by meeting type
- Manager dashboard metrics for the date range.

---

## See also

- [[Developer Guide]] — extending the server-side code
- [[Data Model]] — the sheet tabs these functions read and write
- [[Configuration]] — settings such as `bookingHorizonDays` and `defaultBufferMin`
- [[Testing]] — how the API is exercised
- [[Troubleshooting]] — common errors thrown by the guards
