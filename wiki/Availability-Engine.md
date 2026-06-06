# Availability Engine

The availability engine is the heart of the FSW Booking System. It answers one
question: **"When is this employee bookable in this time window?"**

The defining design choice is that **availability is never stored as fixed slots.**
The only persisted facts are recurring rules, one-off additions, exceptions, time
off, closures, and bookings. Bookable free time is *derived* on demand by interval
arithmetic, every time it is needed. See [[Data Model]] for the tabs behind those
facts, and [[Booking and Concurrency]] for how the manager books into the result.

The code lives in `src/AvailabilityEngine.gs`, with all timezone and calendar
maths in `src/TimeUtil.gs`.

## The formula

```
free = (recurring rules ∪ one-off additions)
       − exceptions
       − time off
       − company closures
       − (confirmed bookings + their buffers)
```

In words:

1. **Build base availability** = expand the employee's active recurring rules
   across the window, then add any active one-off additions. Merge overlaps.
2. **Build the blocked set** = the employee's exceptions + their time off +
   company-wide closures + each **confirmed** booking *extended by its buffer on
   both sides*.
3. **Free = base − blocked** — interval subtraction returning a sorted,
   non-overlapping list of bookable ranges.

### Why compute-on-the-fly

Because cancelled bookings are skipped in step 2, **cancelling a meeting reopens
its time automatically** with no extra bookkeeping — the engine simply stops
subtracting it. Likewise, because buffers are part of the blocked set, every
booking automatically reserves breathing room around itself. There is no slot
table to keep in sync; the persisted facts are the single source of truth and the
free ranges are always recomputed from them.

## Interval algebra

All intervals are plain objects `{ start, end }` in **UTC epoch-milliseconds**,
treated as **half-open `[start, end)`**. Half-open means a meeting ending at 14:00
and one starting at 14:00 do **not** overlap (before buffers are applied).

The algebra is four small, pure helpers:

| Function | Purpose |
|---|---|
| `clipInterval(s, e, winStart, winEnd)` | Intersect `[s, e)` with the window; returns `null` if the result is empty. |
| `intervalsOverlap(aStart, aEnd, bStart, bEnd)` | Half-open overlap test: `aStart < bEnd && bStart < aEnd`. |
| `mergeIntervals(list)` | Sort by start, then union overlapping **or touching** intervals into a disjoint list. |
| `subtractIntervals(base, blocks)` | `base − union(blocks)` → sorted, disjoint remainder. |

`mergeIntervals` merges when `cur.start <= last.end`, so adjacent intervals that
merely touch (e.g. `[9,12)` and `[12,15)`) are joined into one.

`subtractIntervals` first merges the blocks, then for each base segment removes
each block, keeping the **left remainder** (`s.start .. blk.start`) and the
**right remainder** (`blk.end .. s.end`) where they are non-empty. A block fully
covering a segment removes it entirely; a block in the middle splits it in two.
Zero-width results (`s.end <= s.start`) are discarded.

## Recurrence expansion

`expandRule(rule, winStart, winEnd, tz)` turns one recurring rule into concrete
`{start, end}` intervals that overlap the window. It walks **each local calendar
date** in the window (via `eachLocalDate`) and tests whether the rule fires that
day. Each rule has an effective window (`effectiveFromMs` / `effectiveToMs`); days
before the start-of-day of `from` or after the start-of-day of `to` are skipped.
Empty/`null` bounds are treated as `-Infinity` / `+Infinity`.

Supported modes:

| `freq` | Mode | Match test |
|---|---|---|
| `WEEKLY` | — | local day-of-week equals `rule.dayOfWeek` |
| `MONTHLY` | `DOM` (day-of-month) | local day number equals `rule.dayOfMonth` |
| `MONTHLY` | `NTH_DOW` (nth weekday) | local day-of-week equals `rule.nthDayOfWeek` **and** the day is the `rule.nth`th such weekday in its month |

For `NTH_DOW`, `nth = -1` means the **last** occurrence of that weekday in the
month. `isNthWeekdayOfMonth_` computes the occurrence as
`floor((dayOfMonth - 1) / 7) + 1`, and treats "last" as "there is no same weekday
seven days later this month" (`day + 7 > daysInMonth`).

**Impossible dates are simply skipped.** A `DOM` rule for the 31st never fires in
February or any 30-day month, and a 5th-Tuesday `NTH_DOW` rule produces nothing in
months that have only four Tuesdays — because the iterator never visits a matching
day.

On a matching day, the rule's wall-clock `startTimeLocal` / `endTimeLocal`
(`"HH:mm"` strings) are resolved to epoch-ms **for that specific date in the
business timezone**, then clipped to the window before being added to the output.

## DST-safe wall-clock ↔ epoch (TimeUtil)

Recurring rules are written as wall-clock times in the **business timezone** (e.g.
"09:00–12:00 every Tuesday"), but canonical storage is UTC epoch-ms. All
conversion goes through `TimeUtil.gs`; nothing else constructs dates from
wall-clock parts.

The technique used by `tzOffsetMsAt_` is to **measure** a zone's UTC offset at a
given instant by formatting the same `Date` in both the target zone and UTC with
`Utilities.formatDate`, then taking the difference:

```js
const inTz  = Utilities.formatDate(d, tz,    "yyyy-MM-dd'T'HH:mm:ss");
const inUtc = Utilities.formatDate(d, 'UTC', "yyyy-MM-dd'T'HH:mm:ss");
return Date.parse(inTz + 'Z') - Date.parse(inUtc + 'Z');
```

`localPartsToEpochMs(y, mo, d, hh, mm, tz)` then inverts that offset to map
wall-clock → epoch. Because the offset itself depends on the instant, it
**iterates once** to settle correctly across a daylight-saving boundary: compute a
first guess, re-measure the offset at that guess, and if it changed, recompute.

Key TimeUtil helpers used by the engine:

| Function | Role |
|---|---|
| `dateAndTimeToEpochMs(dateParts, "HH:mm", tz)` | Combine a calendar date with a wall-clock time → epoch-ms. |
| `epochToLocalParts(epochMs, tz)` | Break an instant into `{y, mo, d, hh, mm, dow}` (dow 0=Mon..6=Sun). |
| `dowLocal(epochMs, tz)` | Local day-of-week of an instant. |
| `startOfLocalDayMs` / `startOfNextLocalDayMs` | Local midnight boundaries (next-day hops 36h then snaps back, so DST never loses a day). |
| `eachLocalDate(winStart, winEnd, tz, cb)` | Iterate every local date overlapping the window (guard caps at 1000 days). |
| `isNthWeekdayOfMonth_`, `daysInMonth_` | Monthly nth-weekday / last-weekday logic. |

Worked example (from [[Configuration]] defaults, `Europe/London`):

- `09:00` London on **12 Jan 2026** (winter, GMT) → `09:00` UTC.
- `09:00` London on **13 Jul 2026** (summer, BST) → `08:00` UTC.

Both come from the same code path; the one-hour difference is exactly the DST
offset, handled automatically.

## Pure core vs DAL-backed wrapper

The engine is deliberately split so the heavy logic has **no Google dependency**
and can be unit-tested.

### `computeFreeRangesFromData(data, userId, winStart, winEnd, tz)` — pure

Takes in-memory `data` of the shape
`{ rules, additions, exceptions, timeOff, closures, bookings }` plus a user id,
window, and timezone, and returns the free ranges. No Sheet access. The steps map
directly onto the formula:

- Base = active `rules` (expanded) ∪ active `additions` (clipped), then merged.
- Blocks = active `exceptions` + active `timeOff` + active `closures`
  (closures apply to everyone, so they are **not** filtered by user) + each
  booking whose `status` is `CONFIRMED`, expanded to
  `start − bufferBeforeMin` … `end + bufferAfterMin`.
- Result = `subtractIntervals(base, mergeIntervals(blocks))`.

A small `truthy_` helper accepts `true`, `"TRUE"`, `"true"`, `1`, or `"1"` for the
`active` flag, because values arrive from the Sheet in mixed forms. Buffers are
read **off each booking** (`bufferBeforeMin` / `bufferAfterMin`), i.e. the
snapshot taken at booking time — see [[Booking and Concurrency]].

### `computeFreeRanges(userId, winStart, winEnd, opts)` — DAL-backed

The thin wrapper that resolves the business timezone via `getTz()`, loads the data
through `loadAvailabilityData_`, and delegates to the pure function. `opts` may
carry `{ noCache: true }` to bypass the short-lived read cache.

`loadAvailabilityData_` reads each tab (`SHEETS.RULES`, `ADDITIONS`, `EXCEPTIONS`,
`TIME_OFF`, `CLOSURES`, `BOOKINGS`) via `readObjects` and filters to the user and
window up front. Bookings are window-filtered with a **±1-day margin**
(`bOverlaps`) so a buffer that spills across the window edge is still captured;
the other tabs use a plain `overlaps` test. Closures are loaded for everyone
(no user filter).

## Testing

The pure split is what makes the engine unit-testable without a spreadsheet or a
JavaScript runtime. `runAllTests()` covers the algebra (`mergeIntervals`,
`subtractIntervals` including touching boundaries), DST (`dstWinterVsSummerOffset`),
recurrence (`expandRuleWeekly`, `expandRuleMonthlyDom`, `expandRuleMonthlyNthDow`),
buffers (`freeRangesBookingBuffer`), time off and closures
(`freeRangesTimeOffAndClosure`), and the cancel-reopens behaviour
(`freeRangesCancelledBookingReopens`). See [[Testing]] for how to run them.

## Related pages

- [[Data Model]] — the tabs that feed the engine.
- [[Booking and Concurrency]] — how buffers are snapshotted and how the result is booked into.
- [[Configuration]] — `timeZone`, `defaultBufferMin`, `bookingHorizonDays`.
- [[Architecture]] — where the engine sits in the overall design.
