# Manager Guide

This is the day-to-day guide for the **manager** of the FSW Booking System. From the manager screen you can see everyone's meetings, book new meetings for clients, block out closures and time off, view your roster, and run reports on how busy the team has been.

New to the system? Start with [[Getting Started]]. For how meetings are kept clash-free, see [[Booking and Concurrency]]. Employees have their own, narrower screen — see the [[Employee Guide]].

The manager screen has five tabs:

| Tab | What it's for |
|---|---|
| **Schedule** | One calendar of everyone's confirmed meetings; click a meeting to view details, reschedule, or cancel |
| **Book a meeting** | Book a meeting for a client against one employee |
| **Closures** | Company-wide closures, time off for one employee, and the conflicts list |
| **Team** | Your active roster |
| **Reports** | Booked vs offered hours, utilisation, and a breakdown by meeting type |

> All five tabs are manager-only. The system re-checks who you are on every call, so the data and actions on this screen are only available to managers.

---

## Schedule tab

The Schedule tab shows **every employee's confirmed meetings** in one combined calendar (the app uses FullCalendar, with week, day, and month views).

- **Colours per employee.** Each employee has their own colour, so you can tell at a glance whose meeting is whose. The event title reads as *Employee · Client name*.
- **Amber outline = conflict.** A meeting outlined in **amber** (with a ⚠ in its title) clashes with time off or a company closure. Nothing is ever cancelled automatically — the flag is just a heads-up that you should reschedule or cancel that meeting. See [Conflicts to review](#conflicts-to-review).
- **Times shown are business-timezone times.** The calendar renders meetings in the business timezone regardless of the viewer's computer clock, so the time on screen is always the real meeting time.

### Click a meeting for details

Click any meeting to open its detail popup. It shows the client's name, email and phone, the meeting type, the format (in person / phone / video), the purpose/notes, and — if the meeting is flagged — the conflict reason. From the popup you have three actions:

- **Reschedule** — reveals a small form (pre-filled with the current date, start, and length) to move the meeting.
- **Cancel meeting** — prompts for a reason and cancels the meeting.
- **Close** — dismisses the popup.

#### Reschedule a meeting

Choose a **new date, start, and length**, then **Confirm move**. The new slot is validated exactly like a brand-new booking — it must fit fully inside the employee's free time, clear of other meetings, respecting the buffer, and off any time off or closure. On success:

- the meeting moves and the **old time reopens automatically**;
- the conflict flag is **re-evaluated** at the new time (it may clear an old clash or reveal a new one);
- the reminder is reset so a fresh reminder fires for the new time (see [[Notifications]]).

If the new time clashes, the move is rejected with a clear reason and the meeting is left unchanged.

#### Cancel a meeting

Enter an (optional) reason and confirm. The meeting's time **reopens immediately**, any conflict flag is cleared, and the cancellation is recorded. The booking row is **kept, never deleted**, so history and reports stay intact.

Both reschedule and cancel can be done by the manager *or* by the assigned employee (from their own [[Employee Guide]] screen). Every action is written to the audit log with who, when, and what changed.

The calendar and the conflicts list refresh automatically after any booking change.

---

## Book a meeting tab

This is where you create a meeting for a client against one employee.

### The booking flow

1. **Pick the employee** and the **date**.
2. Click **Show free times** to list that employee's free slots for the day (computed by the same availability engine the employee sees — see [[Availability Engine]]). Clicking a slot fills in the start time.
3. Set the **Start**, **Length (min)**, and **Format** (In person / Phone / Video), and optionally a **Meeting type** (e.g. *Consultation*).
4. Enter the **Client name**, **Client email**, and **Client phone**, plus optional **Purpose / notes**.
5. Click **Book meeting**.

### What's required

The form is checked before it's sent:

| Field | Rule |
|---|---|
| Employee | Must be chosen |
| Date | Must be chosen |
| Start time | Required |
| Length | Must be greater than zero (between 5 and 600 minutes) |
| Client name | Required |
| Client email | Must be a valid email address |
| Format | Must be In person, Phone, or Video |

Client email is required because the client receives the booking confirmation and reminder (see [[Notifications]]).

### How the slot is validated

When you book, the system enforces a single rule: the meeting must fit **entirely inside one of the employee's free ranges**, where those ranges already have every other confirmed meeting subtracted *together with its buffer*. In one check that guarantees the meeting is inside marked availability, doesn't overlap another meeting, respects the required buffer gap, and isn't on time off or a closure.

Other things worth knowing:

- **No past bookings.** A start time in the past is rejected.
- **Booking window.** A date beyond the configured booking horizon is rejected (see [[Configuration]]).
- **Buffer snapshot.** The employee's buffer at the moment of booking is stored on the meeting, so later buffer changes won't retroactively break existing meetings.
- **No double-booking, ever.** The save runs under a script-wide lock and re-validates against the latest data, so two managers booking the same slot can never both succeed — the first wins, the second is cleanly rejected. Full detail is in [[Booking and Concurrency]].

If validation fails you'll see a clear message such as *"that time isn't fully within the employee's free time."*

---

## Closures tab

This tab has three sections: **Company closures**, **Time off for an employee**, and **Conflicts to review**.

### Company closures

Block **all** employees at once — for example public holidays or team days. Added once, it applies to everyone.

- **Type** — *Full day(s)* (a From/To date range) or *Part of a day* (a single date with a From/To time).
- Add a **Reason** (e.g. *Bank Holiday*) and click **Add closure**.

Active upcoming closures are listed below the form and can be removed. Adding or removing a closure re-checks everyone's meetings for conflicts.

### Time off for an employee

Block one individual's calendar on their behalf (an employee can also add their own from the [[Employee Guide]]).

- **Pick the employee**, choose **Full day(s)** or **Part of a day**, set the dates/times, and add an optional reason.
- Click **Add time off**.

Upcoming time off for that employee is listed and can be removed.

> **Time off and closures remove availability but never delete a meeting.** If new time off or a closure lands over an existing meeting, the meeting stays confirmed and gets **flagged** instead — it's then yours to reschedule or cancel.

### Conflicts to review

This lists every confirmed meeting that currently **overlaps time off or a closure** — the same meetings shown with an amber outline on the Schedule tab. Use **Refresh** to reload it.

Nothing here is cancelled automatically. To resolve a conflict, go to the **Schedule** tab, click the meeting, and either **Reschedule** it to a clear time or **Cancel** it. Once a flagged meeting is moved off the clash (or cancelled, or once the time off/closure is removed), its flag clears and it drops off this list automatically.

---

## Team tab

The Team tab shows your **active roster** — each employee's name, email, and role.

Adding people isn't done from the screen yet. To add an employee, run this in the Apps Script editor:

```
addEmployee("email@domain", "Full Name")
```

(In-app roster editing is a planned enhancement — see [[Roadmap]].) For the underlying user record and fields, see the [[Data Model]].

---

## Reports tab

The Reports dashboard answers: **how much of the time each employee offered was actually booked, and what kinds of meetings filled it?** It's read-only.

Pick a **From** and **To** date and click **Run**. The tab also auto-runs for the **last 30 days** when it first loads.

You get three things:

- **Per employee** — booked hours, offered (capacity) hours, **utilisation %** (with a small bar), and meeting count.
- **Company totals** — booked vs offered hours, overall utilisation, and total meetings.
- **By meeting type** — total hours and meeting count for each meeting type across the team.

### How the numbers are worked out

| Metric | Meaning |
|---|---|
| **Offered hours** | The capacity the employee made bookable — recurring availability plus one-off additions, **minus** exceptions, time off, and closures — within the range. This is *capacity made available*, not *capacity still free*. |
| **Booked hours** | The duration of **confirmed** meetings in the range, clipped to the range edges so a meeting straddling the boundary only counts its in-range portion. Cancelled meetings are ignored. |
| **Utilisation** | Booked ÷ offered, shown as a percentage. Shows "—" when an employee offered no time (no divide-by-zero). |

Offered hours are computed with the **same availability engine** used everywhere else (just with bookings excluded), so the report can't drift from what the system actually let you book against — see [[Availability Engine]]. A handy sanity check: an employee's *booked + still-free ≈ offered* for the range (buffers and rounding aside).

Notes:

- Offered capacity is measured **before buffers** — buffers only affect what's bookable next to a meeting, not how much time was offered.
- Figures use confirmed meetings only; the full history (including cancellations) stays in the underlying data if deeper analysis is ever needed.
- Date ranges are capped at roughly a year.

---

## Related pages

- [[Booking and Concurrency]] — how slots are validated and double-booking is prevented
- [[Availability Engine]] — how free time is computed
- [[Employee Guide]] — the employee's own screen (availability, time off, my calendar)
- [[Notifications]] — confirmation and reminder emails
- [[Configuration]] — booking horizon, default buffer, and other settings
- [[Data Model]] — the underlying sheets and fields
