# Employee Guide

This guide is for **employees** who take client meetings. It walks through the
employee view of the FSW Booking System: setting the times you're free, marking
time off, and managing your own upcoming meetings.

You only ever see and change **your own** data. The system signs you in
automatically and every action is checked so you can't touch anyone else's
calendar. (Your manager can act on your behalf when needed — see the
[[Manager Guide]].)

The employee view has three tabs:

| Tab | What it's for |
|---|---|
| **My availability** | Tell the system when you're free for clients |
| **Time off** | Block out holidays, sick days, or unavailable hours |
| **My calendar** | See your upcoming meetings; reschedule or cancel them |

New here? Start with [[Getting Started]]. For how the system decides what's
bookable, see the [[Availability Engine]].

---

## My availability

This tab is where you describe when you're available. It's organised into five
cards: **Buffer**, **Recurring availability**, **One-off availability**,
**Exceptions**, and **Preview**.

Everything saves immediately and the lists reload, so what you see always
reflects what's actually stored.

### Buffer between meetings

A buffer is a gap the system automatically keeps clear **before and after each
of your meetings** — for notes, travel, or just a breather. The system will not
book back-to-back meetings if a buffer is set.

- Enter a number of **minutes** and press **Save**.
- Allowed range: **0 to 600 minutes**.
- If you've never set one, the company default buffer applies (see
  [[Configuration]]).

### Recurring availability

These are repeating times you're free for clients. You can add as many patterns
as you like. Each pattern has a **From** and **To** time (within a single day,
and the end must be after the start).

Choose how it **Repeats**:

- **Weekly** — pick a **Day** of the week.
  Example: *"Every Tuesday, 09:00–17:00"*.
- **Monthly** — pick a **Pattern**:
  - **Day of month** — a fixed date number, 1–31.
    Example: *"Day 15 of each month"*.
  - **Nth weekday** — an **Occurrence** (1st, 2nd, 3rd, 4th, 5th, or **Last**)
    and a **Weekday**.
    Example: *"2nd Tuesday of each month"* or *"Last Friday of each month"*.

The form adapts as you choose — picking *Weekly* shows the weekday selector;
picking *Monthly* shows either the day-of-month box or the occurrence + weekday
pair. Existing patterns are listed in plain English with a **Remove** button.

> Recurring patterns are open-ended — they keep repeating until you remove them.

### One-off availability

Extra free time on a **specific date**, on top of your recurring pattern. Use
this when you can take clients at a time you wouldn't normally.

- Pick a **Date**, a **From** and **To** time, and an optional **Note**.
- The slot appears in the list and can be removed.

Only **upcoming** one-off slots are shown — past ones are hidden to reduce
clutter (they stay in the records).

### Exceptions

An exception **removes part of your normal availability** on a specific date —
for example, *"not free this Monday morning"*. It trims your recurring pattern
without affecting it on other days.

- Pick a **Date**, a **From** and **To** time, and an optional **Note**.
- The exception appears in the list and can be removed.

Like one-off slots, only **upcoming** exceptions are shown.

> **Exception vs. time off.** An exception means *"my recurring pattern doesn't
> apply here."* Time off (next tab) means *"I am unavailable here"* — and time
> off can sit over an existing meeting and flag it for the manager, whereas an
> exception is purely availability editing. Use an exception to fine-tune your
> free hours; use time off for actual absence. See [[Data Model]] for the
> distinction.

### Preview — what you're offering

The preview shows your **actual bookable free time** for a date range. It is the
quickest way to sanity-check your setup.

- Pick a **From** and **To** date and press **Show**.
- The range can be at most about **3 months**.

What you see is your free time **after subtracting** meetings, time off,
company closures, and buffers — combined with your recurring patterns, one-off
slots, and exceptions. This isn't an approximation: the preview uses the exact
same calculation the manager's booking screen uses, so what you see here is
precisely what can be booked against you. Details of that calculation are in the
[[Availability Engine]].

### How it all fits together

The system builds your bookable time like this:

1. Start from your **recurring availability** patterns.
2. **Add** any **one-off slots** for the dates in range.
3. **Subtract** your **exceptions**.
4. **Subtract** your **time off** and any company **closures**.
5. **Subtract** existing **meetings** plus their **buffers**.

The leftover is what clients can be booked into.

---

## Time off

Use this tab to mark holidays, sick days, or ad-hoc unavailable blocks. Time off
**overrides your normal availability**, so you won't be booked during it.

Choose a **Type**:

- **Full day(s)** — pick a **From** date and a **To** date to block one or more
  whole days.
- **Part of a day** — pick a single **Date** with a **From** and **To** time.

Add an optional **Reason**, then press **Add time off**. Your upcoming time off
is listed below with **Remove** buttons.

After adding time off, switch to **My availability → Preview** and you'll see
those hours (or whole days) are gone from the affected dates — that's time off
subtracting from your availability.

> **Time off over an existing meeting.** If time off lands on top of a meeting
> you already have, the meeting is **never silently deleted**. It stays booked
> but gets **flagged** so your manager can review it (reschedule or cancel). If
> you later **remove** that time off, the flag clears automatically. See
> [[Booking and Concurrency]] for the warn-and-flag behaviour.

---

## My calendar

This tab lists your **upcoming client meetings**. You can manage your own
meetings directly from here:

- **Reschedule** — opens an inline form, pre-filled with the meeting's details,
  to move it to a new time. The new slot is validated exactly like a fresh
  booking: it must fall inside your free time, be clear of your other meetings,
  respect your buffer, and avoid any time off or closures. If it doesn't fit,
  the move is rejected with a clear reason and nothing changes. When it
  succeeds, the **old time reopens automatically**.
- **Cancel** — cancels the meeting (you can give an optional reason). The time
  becomes bookable again straight away, and any conflict flag on it is cleared.

The list refreshes after each change. You can only reschedule or cancel **your
own** meetings — knowing another meeting's id grants you nothing.

Cancelled meetings aren't erased; they're kept for history but no longer block
your calendar. For more on the reschedule/cancel flow, see the [[Manager Guide]]
and the engine details in [[Booking and Concurrency]].

---

## Tips and good habits

- **Set a realistic buffer** so you're never booked truly back-to-back.
- **Use the Preview** after any change to confirm clients see what you intend.
- **Prefer time off for real absence** (it flags clashes); use **exceptions**
  only to trim recurring hours on a one-off basis.
- **Times use the business timezone.** You only ever type plain dates and times;
  the system interprets them in the company's timezone, so your browser's
  timezone never causes a wrong slot. See [[Configuration]].

If something doesn't look right — a slot you expected is missing, or a change
didn't take — check the [[Troubleshooting]] page.

---

## See also

- [[Getting Started]] — signing in and finding your view
- [[Manager Guide]] — what your manager can see and do
- [[Availability Engine]] — how free time is calculated
- [[Booking and Concurrency]] — booking, reschedule, cancel, and conflict flags
- [[Notifications]] — confirmations and reminders
- [[Home]] — documentation index
