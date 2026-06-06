# Booking and Concurrency

How the FSW Booking System decides whether a meeting is valid, how the
create / reschedule / cancel lifecycle works, and how it guarantees that the
same employee can never be double-booked. The booking write path lives in
`src/BookingApi.gs`; the warn-and-flag recompute lives in `src/TimeOffApi.gs`.

For how free time is computed in the first place see [[Availability Engine]].
For the stored fields referenced here see [[Data Model]]. For who is allowed to
do what, see [[Security and Permissions]].

---

## The single validation rule

A proposed meeting is valid **if and only if** the un-buffered meeting interval
`[start, end)` fits entirely inside **one** of the employee's free ranges.

The free ranges are produced by the availability engine and already have every
*other* confirmed booking subtracted **together with its buffer**, on top of
availability minus exceptions, time off and closures. So this one check enforces,
all at once:

- the meeting is **inside marked availability**;
- it does **not overlap** another meeting;
- it respects the **buffer gap** between meetings;
- it is **not on** time off or a company closure.

The check itself is a single predicate — `[start, end)` must sit fully within one
range:

```js
function meetingFitsFreeRanges_(free, startMs, endMs) {
  return free.some(function (r) { return r.start <= startMs && endMs <= r.end; });
}
```

`validateBooking(userId, startMs, lengthMin, excludeBookingId, opts)` wraps it and
also rejects, with a plain-language reason:

| Condition | Reason returned |
|---|---|
| `lengthMin` not `> 0` | "Enter a meeting length greater than zero." |
| Start in the past (with a 1-minute grace) | "That start time is in the past." |
| Start beyond `bookingHorizonDays` | "That date is beyond the booking window (N days)." |
| User missing or not `active` | "Unknown or inactive employee." |
| Does not fit one free range | "That time isn't fully within the employee's free time …" |

On success it returns `{ ok: true, endMs, bufferMin }`. The booking horizon comes
from `getConfig('bookingHorizonDays')` — see [[Configuration]].

### Why this yields exactly one buffer between meetings (not two)

Each stored booking reserves its buffer on **both** sides
(`bufferBeforeMin` / `bufferAfterMin`). When the engine computes free time, an
existing meeting blocks its own slot **plus** its buffer. A new meeting placed in
the remaining free time is therefore already at least one buffer away from its
neighbour.

When that new meeting is saved (with its own buffer snapshot), it in turn keeps
the *next* meeting a buffer away. The result is a clean, **single** buffer between
consecutive meetings — achieved without ever comparing buffer-against-buffer.
A naïve approach that subtracted both meetings' buffers would double the gap; this
design deliberately avoids that.

### Buffer snapshot

The employee's buffer at the moment of booking is copied **onto the booking row**:

```js
bufferBeforeMin: v.bufferMin, bufferAfterMin: v.bufferMin
```

`bufferMin` is the user's own `bufferMin`, falling back to
`getConfig('defaultBufferMin')` when blank. Because the value is snapshotted, if
an employee later changes their buffer, existing meetings keep the spacing they
were made with — no surprise clashes appear retroactively. A reschedule refreshes
the snapshot to the employee's *current* buffer.

---

## The lifecycle

### Create — `createBooking(payload)`

Manager only (`requireManager()`). Steps:

1. Validate the manager-entered payload (`validateBookingPayload_`): employee,
   date, `HH:MM` start time, positive length, client name, a valid client email,
   and a location/format that is one of in-person / phone / video.
2. Convert the local date + time to an epoch in the business timezone
   (`parseLocalDateTime_`).
3. **Inside the script lock**: re-validate against freshly-committed data, then
   append a new row with a fresh UUID, the buffer snapshot, status `CONFIRMED`,
   flag `NONE`, and `reminderSent = false`. Write a `BOOK` audit entry and flush.
4. **Outside the lock**: best-effort notify (see [[Notifications]]); a notify
   failure never fails the booking.

Returns `{ bookingId }`.

### Reschedule — `rescheduleBooking(bookingId, payload)`

Manager **or** the assigned employee. The new slot is validated exactly like a
fresh booking, with one addition: the booking's **own footprint is excluded** from
the check, so a meeting may be "moved" to overlap where it currently sits.

```js
data.bookings = data.bookings.filter(function (b) {
  return String(b.bookingId) !== String(excludeBookingId);
});
```

On success, inside the lock:

- `startMs` / `endMs` are updated and the **buffer snapshot is refreshed** to the
  employee's current buffer;
- the **old time reopens automatically** — availability is always derived, so
  nothing extra is written to "release" it;
- the **reminder is reset** (`reminderSent = false`, `reminderSentAt = ''`) so a
  fresh reminder fires for the new time;
- the **conflict flag is re-evaluated** via `recomputeFlagsForUsers_` — the move
  may clear an old time-off clash or reveal a new one;
- a `RESCHEDULE` audit entry records `before` / `after` times.

Only `CONFIRMED` meetings can be rescheduled; the lock body re-reads the row and
re-checks the status so a meeting cancelled mid-flight is rejected cleanly.

### Cancel — `cancelBooking(bookingId, reason)`

Manager **or** the assigned employee. Inside the lock:

- status changes to `CANCELLED`;
- the optional `cancelReason` is recorded;
- any conflict flag is cleared (`flag = NONE`, `flagReason = ''`);
- a `CANCEL` audit entry is written, carrying the reason.

The row is **kept, never deleted**, so history and reporting stay intact. Because
the engine ignores cancelled bookings, the time becomes bookable again
immediately.

---

## Concurrency — no double-booking, ever

Google Sheets has no transactions, so a plain "check then write" is a race. The
fix is **LockService** via the `withScriptLock` helper, used on every booking
mutation.

The pattern is **validate-then-write inside the lock**:

1. Acquire the script-wide lock (other callers wait).
2. Re-read / re-validate against **freshly-committed** data — not against what the
   browser saw when the form was opened.
3. Append or update the row, write the audit entry, `SpreadsheetApp.flush()`,
   release.

```js
const created = withScriptLock(function () {
  const v = validateBooking(payload.userId, startMs, payload.lengthMin, null, { nowMs: Date.now() });
  if (!v.ok) throw new Error(v.reason);
  // ... appendObject + logAudit + flush ...
});
```

### Two managers, same slot

If two managers submit the same slot at once, the first acquires the lock and
writes. The second waits, then re-validates **inside** the lock — where it now
*sees* the first booking — and is rejected with "that time isn't free". A
double-booking is structurally impossible.

Note that `validateBooking` and the recompute helpers read with `{ noCache: true }`
so the re-validation always reflects the just-committed state, not a stale cache.
Notifications are sent **after** the lock is released, keeping the critical section
short.

---

## Warn-and-flag (time off over a meeting)

Time off and closures **remove availability** and, unlike a pure availability
exception, can land over an existing meeting. When that happens the meeting is
**never deleted** — it is **flagged**:

- status stays `CONFIRMED`;
- `flag` becomes `TIMEOFF_CONFLICT`, with a human `flagReason`
  (`"Company closure: …"` or `"Time off: …"`).

This keeps status and flag independent: a meeting can be both *confirmed* and
*flagged*, leaving the manager to decide whether to reschedule or cancel.

### Recompute from scratch

Flags are **recomputed**, never tracked incrementally.
`recomputeFlagsForUsers_(userIds, ctx)` re-checks every confirmed meeting of the
affected users against all currently-active closures (everyone) and time off
(per user), and updates **only changed rows**, auditing each `FLAG` / `UNFLAG`
transition. Consequences:

- Adding time off over a meeting flags it (`addTimeOff` / `addClosure`, which also
  return the list of `affected` bookings for an on-screen warning).
- **Removing** the time off or closure that caused a conflict automatically
  clears the flag (`deleteTimeOff` / `deleteClosure`).
- Rescheduling or cancelling a flagged meeting clears its flag too.

Closures override time off in the reason text: a closure overlap is checked first,
and the per-user time-off loop only runs if no closure matched. Flagged meetings
are surfaced to the manager by `getFlaggedBookings()` and shown with an amber
outline and a `⚠` prefix on the calendar (see [[Manager Guide]]). More detail on
time off and closures lives in [[Notifications]] context and the engine page,
[[Availability Engine]].

---

## Permissions

| Action | Who | Guard |
|---|---|---|
| `createBooking` | Manager only | `requireManager()` |
| `getCalendarBookings` | Manager only | `requireManager()` |
| `getMyUpcomingBookings` | Manager or that employee | `requireSelfOrManager(userId)` |
| `rescheduleBooking` | Manager or the **assigned** employee | `requireSelfOrManager(booking.userId)` |
| `cancelBooking` | Manager or the **assigned** employee | `requireSelfOrManager(booking.userId)` |

Every reschedule / cancel re-derives the caller's identity from the session and
checks against the booking's **own** employee — so knowing a booking id alone
grants nobody access. See [[Security and Permissions]] for the identity model.

---

## Audit

Every mutation writes an append-only audit entry via `logAudit` (who, when, and a
before/after snapshot):

| Action constant | When |
|---|---|
| `BOOK` | Booking created |
| `RESCHEDULE` | Booking moved (records old/new times) |
| `CANCEL` | Booking cancelled (records the reason) |
| `FLAG` / `UNFLAG` | A meeting gains or loses a `TIMEOFF_CONFLICT` flag |

Booking snapshots use `bookingAudit_` (employee, client name, start/end, status,
meeting type). Audit is written **inside** the lock alongside the data change.

---

## Related pages

[[Availability Engine]] · [[Data Model]] · [[Manager Guide]] ·
[[Employee Guide]] · [[Notifications]] · [[Security and Permissions]] ·
[[Configuration]] · [[API Reference]] · [[Testing]]
