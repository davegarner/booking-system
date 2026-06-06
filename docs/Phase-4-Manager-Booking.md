# FSW Booking System — Phase 4: Manager Booking

**Document version:** 1.0
**Date:** 2026-06-06
**Phase status:** Complete
**Audience:** Project owner / reviewer (and future developers)

---

## 1. Purpose of this document

This is the design-and-build record for **Phase 4**, the heart of the system: the manager's combined
calendar and the booking flow. It turns the availability data from Phases 2–3 into actual client meetings,
with a guarantee that the same employee can never be double-booked. It builds on the availability engine
(Phase 0), the roles/shell (Phase 1), availability (Phase 2), and time off/closures (Phase 3).

---

## 2. What the manager can now do

On the **Schedule** tab:
- See every employee's confirmed meetings in one calendar (week / day / month views), colour-coded per
  employee.
- Click any meeting to see its full details. Meetings that clash with time off or a closure are outlined in
  amber (the Phase 3 conflict flag, now visible).

On the **Book a meeting** tab:
- Pick an employee and a date, and **show their free times** for that day (computed by the same engine the
  employee sees in their own preview).
- Enter the meeting (start, length, format) and the client's details (name, email, phone, meeting type,
  purpose) and **Book** — the system validates and saves it, and the calendar updates.

---

## 3. The booking rule (how validity is decided)

A proposed meeting is valid **if and only if** the meeting interval fits entirely inside **one** of the
employee's free ranges — where those free ranges already have every *other* confirmed booking subtracted
*together with its buffer*, on top of availability minus exceptions, time off and closures.

That single check enforces, all at once:
- the meeting is **inside marked availability**;
- it does **not overlap another meeting**;
- it respects the **buffer gap** between meetings;
- it isn't on **time off or a closure**.

### Why this gives exactly one buffer between meetings

Each stored booking reserves its buffer on both sides. When we compute free time, an existing meeting blocks
its slot *plus* its buffer. A new meeting placed in the remaining free time is therefore already at least one
buffer away from its neighbour — and when the new meeting is saved (with its own buffer snapshot), it in turn
keeps the next meeting a buffer away. The result is a clean, single buffer between consecutive meetings (not a
doubled gap), achieved without a second check. This is a deliberate simplification over a naïve
"buffer-vs-buffer" comparison.

### Buffer snapshot

The employee's buffer at the moment of booking is stored **on the booking** (`bufferBeforeMin` /
`bufferAfterMin`). If they later change their buffer, existing meetings keep the spacing they were made with —
no surprise clashes appear retroactively.

---

## 4. No double-booking — ever (concurrency)

Google Sheets has no transactions, so "check then write" is a race. The booking write path therefore runs
inside a **script-wide lock**:

1. Acquire the lock (others wait).
2. Flush pending writes and **re-validate against freshly-committed data** — not against what the browser saw
   when the form was opened.
3. Append the booking, write the audit entry, flush, release.

If two managers try the same slot at once, the first wins; the second re-validates inside the lock, now *sees*
the first booking, and is cleanly rejected with "that time isn't free". A double-booking is structurally
impossible. Every booking is recorded in the append-only audit log.

---

## 5. The calendar (display details)

The Schedule tab uses **FullCalendar** (loaded from a pinned CDN, which works inside the Apps Script / Google
Sites iframe). Two notes for reviewers:

- **Timezone:** events are sent as plain business-timezone wall-clock and the calendar is set to render in
  "UTC", so the times shown are exactly the business-timezone numbers regardless of the viewer's own computer
  timezone. (This avoids a whole class of "meeting shows an hour off" bugs.)
- **Colour & flags:** each employee has a colour; flagged (conflicting) meetings get an amber outline and a ⚠
  in the title, so the manager spots problems at a glance.

The booking form does not use a drag-on-calendar interaction; instead it offers a clear "show free times"
helper and explicit fields, which is less error-prone for precise client details.

---

## 6. What a booking records

Employee, start/end, the buffer snapshot, status, conflict flag — plus the client fields agreed in planning:
**name, email, phone, purpose/notes, location/format (in person / phone / video), and meeting type**. Client
email is required because the client will receive confirmations and reminders (Phase 6).

---

## 7. Files

- `src/BookingApi.gs` — `validateBooking` (the rule above), `createBooking` (manager-only, under the lock),
  and `getCalendarBookings` (events for the calendar). Helpers for colours and timezone-safe formatting.
- `src/ui/Manager.html` — the Schedule calendar, the Book form, the FullCalendar include, and the detail modal.
- `src/ui/JsManager.html` — the calendar wiring, the booking flow, and the detail popup.
- `src/ui/Styles.html` — modal, clickable free-time chips, flagged-event outline.
- `src/Tests.gs` — three new booking-validation tests (now 13 in total).

---

## 8. Tests added

| Test | What it proves |
|---|---|
| `bookingFitsInFreeRange` | A meeting inside availability is accepted; one before availability is rejected |
| `bookingRespectsBufferGap` | A meeting up to the buffer edge is allowed; one crossing into the buffer is rejected |
| `bookingExcludeSelfOnReschedule` | Excluding a booking's own footprint frees its slot (the basis for Phase 5 reschedule) |

Run `runAllTests()` → expect `13/13 passed`.

---

## 9. How to verify

Push (`clasp push`). Make sure an employee has availability (Phase 2). As the **manager**:

| Step | Expected |
|---|---|
| Book tab → pick employee + date → **Show free times** | The employee's free slots for that day appear; clicking one fills the start |
| Fill client name + a valid email, choose format, **Book** | "Meeting booked."; it appears on the Schedule calendar |
| Try to book an overlapping time for the same employee | Rejected — "that time isn't free" |
| Try a time inside the buffer of an existing meeting | Rejected |
| Add time off (Phase 3) over an existing meeting | The meeting gains an amber outline; it also appears in *Closures → Conflicts to review* |
| Click a meeting | The detail modal shows client info (and the conflict reason if flagged) |

---

## 10. What's next

| Phase | Deliverable |
|---|---|
| **5** | **Reschedule & cancel** — move a meeting to a new valid slot (old time reopens) or cancel it (with a reason); resolving a flagged meeting clears its flag. Available to the manager and the assigned employee. |
| 6 | Email notifications (booked / rescheduled / cancelled) + the 24-hour reminder |
| 7 | Reporting dashboard |

Phase 5 will ship its own `.md` and `.docx` document.
