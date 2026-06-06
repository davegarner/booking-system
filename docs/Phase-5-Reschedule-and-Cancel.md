# FSW Booking System — Phase 5: Reschedule & Cancel

**Document version:** 1.0
**Date:** 2026-06-06
**Phase status:** Complete
**Audience:** Project owner / reviewer (and future developers)

---

## 1. Purpose of this document

This is the design-and-build record for **Phase 5**, which completes the booking lifecycle: meetings can now
be **moved** or **cancelled**, by the manager or the assigned employee, safely and with a full history. It
builds directly on the Phase 4 booking engine.

---

## 2. What's new

- **Reschedule** a meeting to a new time. The new slot is validated exactly like a fresh booking; the old time
  reopens automatically.
- **Cancel** a meeting with an optional reason. The time reopens and any conflict flag is cleared.
- Both actions are available to **the manager** (from the Schedule calendar) and to **the assigned employee**
  (from their new *My calendar* list).
- Resolving a flagged (time-off-clash) meeting by moving or cancelling it **clears the flag** and removes it
  from the manager's *Conflicts to review* list.

---

## 3. How it works

### 3.1 Reschedule

Moving a meeting re-uses the Phase 4 validator, with one addition: the booking's **own** footprint is ignored
during the check (so a meeting can be "moved" to overlap where it currently sits). The new time must still be
fully inside the employee's free time, clear of other meetings, respecting the buffer, and off any time
off/closure. On success:

- the meeting's start/end are updated and its buffer snapshot refreshed to the employee's current buffer;
- the **old time reopens automatically** — because availability is always derived, nothing extra is needed;
- the meeting's conflict flag is **re-evaluated** at the new time (it may clear an old clash or reveal a new
  one);
- the reminder is **reset** so a fresh reminder will fire for the new time (Phase 6).

Like booking, reschedule runs inside the script lock and re-validates against freshly-committed data, so it
can't race another change into a double-booking.

### 3.2 Cancel

Cancelling sets the meeting's status to *cancelled*, records the optional reason, and clears any conflict
flag. The booking row is **kept** (never deleted), so history and reporting stay intact; because the engine
ignores cancelled bookings, the time immediately becomes bookable again.

### 3.3 Who can do it

Every reschedule/cancel call re-derives the caller's identity from the session and checks
`requireSelfOrManager(<the booking's employee>)` — so the manager can act on any meeting, an employee only on
their own, and knowing a booking's id alone grants nobody access. Both actions are fully audited (who, when,
before/after, and the cancel reason).

---

## 4. The interface

**Manager (Schedule tab):** clicking a meeting opens its detail modal, which now has **Reschedule** (reveals a
date/start/length form, pre-filled from the meeting) and **Cancel meeting** (prompts for a reason). After
either action the calendar and the conflicts list refresh automatically.

**Employee (My calendar tab):** a list of the employee's upcoming meetings, each with **Reschedule** (an
inline pre-filled form) and **Cancel**. The list refreshes after each change.

**Live refresh:** booking changes broadcast a small in-page event; the calendar re-fetches and the conflicts
list reloads in response, so the manager's views stay in sync without a manual refresh.

### A bug fixed along the way

The employee view had a single view-wide handler for availability "Remove" buttons. With time-off and cancel
buttons (also styled as danger buttons) now living in the same view, that handler was tightened to act **only**
on availability buttons (which carry a `data-kind`), preventing any cross-firing between the three lists.

---

## 5. Files

- `src/BookingApi.gs` — added `getMyUpcomingBookings`, `rescheduleBooking`, `cancelBooking`, and a
  `bookingDetail_` projection.
- `src/ui/Manager.html` — the detail modal gained reschedule/cancel controls and an inline move form.
- `src/ui/JsManager.html` — reschedule/cancel wiring; an in-page "bookings changed" event drives calendar and
  conflict refresh.
- `src/ui/Employee.html` — the *My calendar* tab built out.
- `src/ui/JsEmployee.html` — the *My calendar* list with inline reschedule/cancel (and the delegation fix).
- `src/ui/Styles.html` — styles for the calendar list items.

No new data fields were needed — Phase 0 already provided status, cancel reason, and the reminder fields.

---

## 6. How to verify

Push (`clasp push`). With at least one booking (Phase 4):

| Step | Expected |
|---|---|
| Manager clicks a meeting → Reschedule → pick a new valid time → Confirm | Meeting moves; old slot becomes free again; calendar updates |
| Reschedule onto a clashing time | Rejected with a clear reason; meeting unchanged |
| Manager clicks a meeting → Cancel → enter a reason | Meeting disappears from the calendar; time is bookable again |
| Add time off over a meeting, then cancel/reschedule that meeting | The amber flag and the *Conflicts to review* entry clear |
| Employee opens *My calendar* → Reschedule / Cancel their own meeting | Works; an employee cannot act on someone else's meeting |
| Check the `AuditLog` tab | BOOK / RESCHEDULE / CANCEL entries with who, when, and before/after |

---

## 7. What's next

| Phase | Deliverable |
|---|---|
| **6** | **Email notifications** — confirmations to the employee, client and manager on booked / rescheduled / cancelled, plus a 24-hour reminder (a scheduled job, de-duplicated; reset on reschedule, which Phase 5 already wired) |
| 7 | Reporting dashboard |
| 8 | Deployment & Google Sites embedding |

Phase 6 will ship its own `.md` and `.docx` document.
