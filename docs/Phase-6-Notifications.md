# FSW Booking System — Phase 6: Email Notifications & Reminders

**Document version:** 1.0
**Date:** 2026-06-06
**Phase status:** Complete
**Audience:** Project owner / reviewer (and future developers)

---

## 1. Purpose of this document

This is the design-and-build record for **Phase 6**, which keeps everyone informed by email: confirmations
when a meeting is booked, moved or cancelled, plus an automatic reminder before each meeting. It uses Google
Workspace mail only — no third-party service, no extra cost. It builds on the booking lifecycle from
Phases 4–5.

---

## 2. What's new

- **On booking, reschedule and cancellation**, emails go to:
  - the **client** (a friendly confirmation; replies go to the employee),
  - the assigned **employee** (the operational details, including the client's contact info and notes),
  - the **manager(s)** (a copy for oversight).
- **A reminder** is sent automatically before each meeting (default **24 hours**, configurable), to the
  **client** and **employee**.

All emails are sent through your Workspace account; the sender name is the configured company/app name.

---

## 3. How it works

### 3.1 Tailored, private-by-design

Each recipient gets a message written for them rather than one shared email:
- the client's email never exposes staff email addresses and carries a **reply-to of the employee**, so a
  client reply lands with the right person;
- the staff email includes the client's name, email, phone and any notes — the things the employee needs.

Every message is sent as both **HTML and plain text**, branded with the company name.

### 3.2 Sent safely, never blocking a booking

Emails are sent **after** the booking lock is released and are wrapped so that any mail failure is logged but
**never affects the booking itself** — a meeting is saved whether or not an email goes out. Before sending,
the remaining daily mail quota is checked; if it's exhausted the send is skipped and logged rather than
throwing.

### 3.3 The reminder job

A single **hourly time-driven trigger** runs `sendDueReminders`, which:
1. finds confirmed meetings starting within the reminder lead time that **haven't been reminded yet**;
2. emails the client and employee;
3. marks each meeting **reminded** (with a timestamp) so it can never be sent twice.

Because Phase 5 **resets the reminded flag when a meeting is rescheduled**, a moved meeting correctly gets a
fresh reminder for its new time. Hourly resolution is deliberate — it sends "within the hour it's due" while
staying well inside Apps Script's trigger limits.

> **Design choice:** reminders go to the client and employee only, not the manager — a manager copy of every
> reminder every day is noise. Booking/reschedule/cancel emails *do* copy the manager. This is a one-line
> change in `Notifications.gs` if you ever want manager reminders.

### 3.4 Quota

On a Workspace account the mail limit is generous (~1,500 recipients/day, pooled on the owner). A booking
event is three recipients; even a busy day for a 10-person team stays comfortably within the limit. The code
guards against the edge case anyway.

---

## 4. Setup

`setup()` now also installs the reminder trigger (`installTriggers()`), so once you've run setup the reminder
job is live. It's safe to re-run — installing **removes any existing reminder trigger first**, so duplicates
never accumulate. If trigger installation is ever skipped (e.g. a permissions hiccup), just run
`installTriggers()` once from the editor. The required mail scope (`script.send_mail`) is already declared in
the manifest.

---

## 5. Files

- `src/Notifications.gs` — email composition (per event, per audience) and sending (`notifyBooking_`,
  `sendMail_`, quota guard, HTML+text templates).
- `src/Reminders.gs` — `sendDueReminders` (the hourly job, with de-duplication).
- `src/Triggers.gs` — `installTriggers` / `removeTriggers` (idempotent).
- `src/BookingApi.gs` — `createBooking`, `rescheduleBooking`, `cancelBooking` now call `notifyBooking_` after
  the lock.
- `src/Setup.gs` — runs `installTriggers()` during setup.

No schema changes — the `reminderSent` / `reminderSentAt` fields were already in place from Phase 0.

---

## 6. How to verify

Push (`clasp push`) and re-run `setup()` once (to install the trigger and approve the mail scope). Use real
email addresses you can read (e.g. your own as the client).

| Step | Expected |
|---|---|
| Book a meeting with your email as the client | Three emails arrive: client (confirmation), employee, manager |
| Reschedule that meeting | Emails arrive showing the new time, with a "Previously" line for the old one |
| Cancel it | Cancellation emails arrive, including the reason if you gave one |
| Test reminders without waiting | Either set `reminderLeadHours` high (e.g. 720) in the `Config` tab so an upcoming meeting falls in range, **or** run `sendDueReminders` manually from the editor — the client and employee get a reminder, and a second run sends nothing (de-duplicated) |
| Reschedule a reminded meeting | Its reminder flag resets, so the next run reminds again for the new time |

> Tip: while testing, watch **View → Executions / Logs** in the editor for `sendDueReminders` output and any
> skipped-send messages.

---

## 7. What's next

| Phase | Deliverable |
|---|---|
| **7** | **Reporting dashboard** — hours booked vs available, utilisation per employee, and a breakdown by meeting type, over a chosen date range |
| 8 | Deployment & Google Sites embedding + the user-acceptance test pass |

Phase 7 will ship its own `.md` and `.docx` document.
