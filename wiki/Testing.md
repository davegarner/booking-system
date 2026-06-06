# Testing

The FSW Booking System is tested at two levels:

1. **Automated unit tests** — `runAllTests()` in `src/Tests.gs`, which exercises the correctness-critical core (timezone maths, recurrence, the availability engine, and booking validation) with pure, in-memory data.
2. **Manual user-acceptance testing (UAT)** — a step-by-step matrix run against a real deployment after going live.

This page explains both. For the full UAT table and the going-live checklist, see [[Deployment]]. For background on the algorithms under test, see [[Availability Engine]] and [[Booking and Concurrency]].

---

## Where the tests live

All automated tests are in a single file, `src/Tests.gs`. They are **pure**: they call `TimeUtil` and the `AvailabilityEngine` directly with hand-built in-memory objects and a fixed timezone (`Europe/London`), so they need no data spreadsheet and never touch production data.

```js
const TEST_TZ = 'Europe/London';
```

A few small helpers make the tests readable:

| Helper | Purpose |
|---|---|
| `assert_(cond, msg)` | Throws if `cond` is falsy. |
| `assertEq_(actual, expected, msg)` | Throws unless `actual === expected`. |
| `ivs_(arr)` | `JSON.stringify` an interval list for easy comparison. |
| `ms_(y, mo, d, hh, mm)` | Wall-clock → epoch-ms in `TEST_TZ` (wraps `localPartsToEpochMs`). |

---

## How to run the tests

There is **no JavaScript runtime on the build machine**, and the timezone logic depends on Google's `Utilities` service, so the tests are designed to run **inside Apps Script** — not locally. Two ways to run them:

- **Apps Script editor:** open the project, select `runAllTests` in the function dropdown, and click **Run**. Read the result in the execution log (Logger output).
- **From the CLI:** `clasp run runAllTests` (requires the Apps Script API enabled and `clasp` set up — see [[Getting Started]] and [[Deployment]]).

Run against a **dev sheet / dev deployment**, never production — although the suite is pure and does not read or write any spreadsheet, so it is safe by design.

`runAllTests()` runs every `test_*` function, logs `PASS`/`FAIL` per test, and returns a summary object:

```js
{ pass: <number>, fail: <number>, failures: [<string>, ...] }
```

It also logs a one-line summary, e.g. `13/13 passed`. A green run is **all 13 tests passing**.

> Note: each test was additionally hand-traced against the implementation, because the suite cannot be run on the build machine.

---

## What `runAllTests()` covers

The suite has **13 tests** grouped into four areas. The table below maps each test to what it proves.

### Interval algebra

| Test | What it proves |
|---|---|
| `test_mergeIntervals_` | `mergeIntervals` merges overlapping and *touching* intervals (e.g. `0–10` + `10–20` → `0–20`) and sorts the result. |
| `test_subtractIntervals_` | `subtractIntervals` punches holes correctly: `0–100` minus `20–30` and `50–60` → three ranges. |

These two functions are the backbone of the availability engine — see [[Availability Engine]].

### Timezone / DST

| Test | What it proves |
|---|---|
| `test_dstWinterVsSummerOffset_` | Wall-clock → epoch is DST-safe. `09:00` London on **12 Jan 2026** (GMT) → `09:00` UTC; `09:00` London on **13 Jul 2026** (BST) → `08:00` UTC. |
| `test_localPartsRoundTrip_` | `epochToLocalParts` is the consistent inverse of `localPartsToEpochMs` (year/month/day/hour/minute round-trip). |

### Recurrence expansion

These test `expandRule(rule, windowStart, windowEnd, tz)` for each recurrence shape.

| Test | What it proves |
|---|---|
| `test_expandRuleWeekly_` | A weekly rule (`FREQ.WEEKLY`, `dayOfWeek`) lands on the right day and time — one Tuesday `09:00–12:00` in a Mon–Mon window. |
| `test_expandRuleMonthlyDom_` | Monthly **by day-of-month** (`MONTHLY_MODE.DOM`, `dayOfMonth: 15`) produces the 15th `10:00–11:00`. |
| `test_expandRuleMonthlyNthDow_` | Monthly **by nth-weekday** (`MONTHLY_MODE.NTH_DOW`, `nth: 2`, `nthDayOfWeek: 1`) resolves the 2nd Tuesday of June 2026 (9 Jun) `13:00–14:00`. |

### Free-range computation

These call the pure `computeFreeRangesFromData(data, userId, windowStart, windowEnd, tz)`.

| Test | What it proves |
|---|---|
| `test_freeRangesBookingBuffer_` | A confirmed booking carves out **itself plus its buffer** on both sides. Base `09:00–17:00` with a `12:00–13:00` booking and 15-min buffers → free `09:00–11:45` and `13:15–17:00`. |
| `test_freeRangesTimeOffAndClosure_` | **Time off** and **company closures** both remove availability. Partial time off `09:00–10:00` and a closure `16:00–17:00` leave free `10:00–16:00`. |
| `test_freeRangesCancelledBookingReopens_` | A **cancelled** booking (`BOOKING_STATUS.CANCELLED`) does *not* subtract availability — its time stays free. |

### Booking validation

These check `meetingFitsFreeRanges_(freeRanges, start, end)` against computed free ranges.

| Test | What it proves |
|---|---|
| `test_bookingFitsInFreeRange_` | A meeting inside availability fits (`10:00–11:00`); one before availability (`08:00–09:00`) is rejected. |
| `test_bookingRespectsBufferGap_` | An existing `12:00–13:00` booking with a 15-min buffer blocks `11:45–13:15`. A new meeting ending exactly at `11:45` fits (half-open `[start, end)`); one running to `11:50` crosses into the buffer and is rejected. |
| `test_bookingExcludeSelfOnReschedule_` | When rescheduling, a booking's own slot is blocked while it is present, but fits once that booking is excluded from the data — so a meeting can be rescheduled onto its own time. |

Together these confirm the rules described in [[Booking and Concurrency]]: meetings must fit inside derived free time, must respect snapshotted buffers, use half-open intervals, and must exclude themselves when revalidating a reschedule.

---

## Manual UAT (smoke checks)

After deploying (see [[Deployment]]), run the full **UAT matrix** — 30 numbered steps covering setup/access, employee availability, time off and closures, booking, reschedule/cancel, notifications, reporting, and Google Sites embedding. The complete table lives in [[Deployment]]; do not duplicate it here.

Run UAT with **two accounts** where possible (a manager and an employee), and test both **inside the Google Site iframe** and via the **direct `/exec` URL**.

The key smoke checks — the rows worth running every time — are:

| Check | Expected |
|---|---|
| `runAllTests()` in the editor | `13/13 passed`. |
| **Book** a valid meeting | Appears on the Schedule calendar; client, employee, and manager emails arrive. See [[Notifications]]. |
| **Double-book** the same slot | The overlapping booking is rejected ("not free"). |
| **Concurrency** — two near-simultaneous bookings of one slot | Exactly one succeeds (the `LockService` guard; see [[Booking and Concurrency]]). |
| **Conflict** — add time off over an existing meeting | Meeting outlined amber and listed in *Conflicts to review*. |
| **Notify** — reschedule/cancel | Emails arrive (old→new, or cancel reason); a second reminder run sends nothing. |
| **Report** — Reports tab, then re-book and re-run | Per-employee booked/offered/utilisation update. |

The going-live checklist in [[Deployment]] requires at least the booking, conflict, notification, and reporting rows to pass.

---

## Related pages

- [[Availability Engine]] — the interval algebra and `computeFreeRanges` under test.
- [[Booking and Concurrency]] — buffer rules, half-open intervals, and the double-booking lock.
- [[Deployment]] — the full UAT matrix and going-live checklist.
- [[Developer Guide]] / [[API Reference]] — the functions the tests exercise.
- [[Troubleshooting]] — what to do when a smoke check fails.
