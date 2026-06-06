# FSW Booking System — Phase 3: Time Off & Company Closures

**Document version:** 1.0
**Date:** 2026-06-06
**Phase status:** Complete
**Audience:** Project owner / reviewer (and future developers)

---

## 1. Purpose of this document

This is the design-and-build record for **Phase 3**. It adds the ability to *remove* availability — holidays,
sick days, ad-hoc unavailable blocks, and company-wide closures — and introduces the **warn-and-flag** rule:
when time off lands over a meeting, the meeting is never silently deleted; it is flagged for the manager to
deal with. It builds on the availability model (Phase 0/2) and the role-based shell (Phase 1).

---

## 2. What's new

**For employees** (the *Time off* tab):
- Add **full-day** time off across a date range, or **partial-day** time off (a date with start/end times),
  each with an optional reason.
- See and remove their upcoming time off.

**For the manager** (the *Closures* tab):
- **Company closures** — block *all* employees at once (public holidays, team days), full-day or partial,
  added once.
- **Time off for an employee** — block any individual's calendar on their behalf.
- **Conflicts to review** — a live list of meetings that currently clash with time off or a closure.

---

## 3. How it works

### 3.1 Time off vs. exceptions (a deliberate distinction)

Phase 2 introduced *exceptions* — an employee trimming their own recurring pattern. Phase 3 adds *time off*,
which is different in an important way:

| | Exception (Phase 2) | Time off / closure (Phase 3) |
|---|---|---|
| Meaning | "My recurring pattern doesn't apply here" | "I am unavailable here" |
| Can sit over a booking? | No (it's pure availability editing) | **Yes** — and then it flags the booking |
| Scope | One employee | Time off = one employee; closure = everyone |

Keeping them separate keeps each concept simple.

### 3.2 Full-day vs. partial

A **full-day** block is stored from local midnight of the first day to local midnight after the last day, so
it correctly covers whole days (even across daylight-saving changes). A **partial** block is a single date
with explicit start/end times. As always, the browser sends plain dates/times and the server converts them in
the business timezone.

### 3.3 Warn-and-flag

When time off or a closure is saved, the system finds every **confirmed** meeting it overlaps and reports the
count back to the screen — e.g. *"Closure added. ⚠ 2 existing meeting(s) now conflict and are flagged for
review."* Those meetings stay confirmed but gain a **conflict flag** (a field kept separate from status, so a
meeting can be both *confirmed* and *flagged*). The manager resolves them by rescheduling or cancelling
(Phases 4–5). Nothing is ever auto-deleted.

The flag is **recomputed from scratch** whenever time off or a closure is added or removed: each affected
employee's confirmed meetings are re-checked against all currently-active time off and closures, and only
changed rows are updated (with a FLAG/UNFLAG audit entry). This means removing the time off that caused a
conflict automatically clears the flag — no fragile bookkeeping.

> Because client bookings don't exist until Phase 4, the conflicts list will be empty for now. The logic is
> fully wired and will light up as soon as bookings are made.

### 3.4 Everything is locked and audited

Adding/removing time off and closures runs inside the script lock (so flag recomputation can't race with a
booking) and writes audit entries for the time off/closure itself and for every flag change.

---

## 4. The interface

**Employee → Time off:** a single form with a *Type* selector (Full day(s) / Part of a day) that reveals the
right fields, a reason, and the list of upcoming time off with **Remove** buttons.

**Manager → Closures:** three cards —
1. *Company closures* — add/list/remove closures that block everyone.
2. *Time off for an employee* — pick a person from the roster and block their calendar; the list updates per
   selected employee.
3. *Conflicts to review* — refreshable list of currently-flagged meetings, each showing the employee, client,
   time, and the reason for the clash.

The full-day/partial form pattern is shared (one helper drives all three forms), keeping behaviour consistent.

### Files

- `src/TimeOffApi.gs` — server API: `getTimeOff`/`addTimeOff`/`deleteTimeOff`, `getClosures`/`addClosure`/
  `deleteClosure`, `getRoster`, `getFlaggedBookings`, plus the shared warn-and-flag recompute.
- `src/Schema.gs` — `Closures` tab gained a `scope` column (matching time off).
- `src/ui/Employee.html` — the *Time off* tab built out.
- `src/ui/Manager.html` — the *Closures* tab built out.
- `src/ui/JsEmployee.html` — added the time-off logic.
- `src/ui/JsManager.html` — new; drives all manager screens (Closures tab in this phase).
- `src/ui/JsCommon.html` — shared helpers (`collectSpan`, `syncSpanFields`, `busy`, `affMsg`, …).
- `src/ui/Index.html` — now also injects the manager script on the manager view.

---

## 5. How to verify

Push (`clasp push`). As an **employee**, on *Time off*: add a full-day holiday and a partial block; both
appear in the list and can be removed. Switch to *My availability* → *Preview*: the time-off hours are now
missing from the affected days (proving time off subtracts from availability).

As the **manager**, on *Closures*: add a company closure for a date range — it appears in the list; pick an
employee and add time off for them — it appears under that employee. (The *Conflicts* list stays empty until
there are bookings in Phase 4; after Phase 4 you can confirm that adding time off over a meeting flags it.)

| Check | Expected |
|---|---|
| Employee adds full-day time off | Appears as "All day · …"; preview loses those days |
| Employee adds partial time off | Appears with the time range; preview loses those hours |
| Manager adds a closure | Appears in closures list; toast confirms (with conflict count once bookings exist) |
| Manager adds time off for an employee | Appears under the selected employee |
| Remove any entry | Disappears; availability/flags recompute |

---

## 6. What's next

| Phase | Deliverable |
|---|---|
| **4** | **Manager booking** — a combined calendar of everyone's free time and a booking form (client details, validation, the double-booking lock). This is where the conflict-flagging from Phase 3 starts to matter. |
| 5 | Reschedule & cancel, surfacing and clearing conflicts |
| 6 | Email notifications & reminders |

Phase 4 will ship its own `.md` and `.docx` document.
