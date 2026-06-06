# FSW Booking System

An internal client-booking system for a ~10-person business, built entirely inside **Google Workspace**:
a **Google Apps Script** web app backed by **Google Sheets**, surfaced through your **Google Site**.
Employees publish when they're free; the manager books client meetings into that availability — with
double-booking made impossible, automatic email confirmations and reminders, and a utilisation dashboard.
Clients never log in: they contact the business as usual and the manager records the booking.

> **Status: v1 complete.** All features below are built. See [[Getting Started]] to stand it up and
> [[Deployment]] to go live.

## New here? Start with your role

- 🧑‍💼 **An employee?** → [[Employee Guide]] — set your availability, time off, and manage your meetings.
- 🗂️ **The manager?** → [[Manager Guide]] — book clients, handle closures, review conflicts, run reports.
- 🛠️ **Setting it up?** → [[Getting Started]] then [[Deployment]].
- 👩‍💻 **A developer?** → [[Architecture]], [[Developer Guide]], [[API Reference]].

## What it does

- **Employee availability** — recurring weekly/monthly patterns, one-off slots, exceptions, and a personal
  buffer between meetings. ([[Employee Guide]], [[Availability Engine]])
- **Time off & company closures** — block individual or whole-company time; existing meetings caught by new
  time off are flagged, never deleted. ([[Manager Guide]], [[Booking and Concurrency]])
- **Manager booking** — a combined calendar plus a booking form with full client details; the booking engine
  guarantees no overlaps and respects buffers. ([[Booking and Concurrency]])
- **Reschedule & cancel** — by the manager or the assigned employee, fully audited.
- **Email notifications & reminders** — to client, employee and manager via Google Workspace. ([[Notifications]])
- **Reporting** — booked vs offered hours, utilisation, and a breakdown by meeting type.

## How it works (under the hood)

| Topic | Page |
|---|---|
| The big picture, stack, and key decisions | [[Architecture]] |
| Every Sheet tab and column | [[Data Model]] |
| How bookable free time is computed | [[Availability Engine]] |
| Booking rules, buffers, locking, warn-and-flag | [[Booking and Concurrency]] |
| Emails and the reminder job | [[Notifications]] |
| Identity, roles, and the audit trail | [[Security and Permissions]] |
| Editable settings (timezone, buffers, reminders) | [[Configuration]] |

## Operating it

- [[Deployment]] — deploy the web app and embed it in Google Sites.
- [[Testing]] — the unit tests and the acceptance checklist.
- [[Troubleshooting]] — common issues and fixes.
- [[Roadmap]] — what's deferred for later.

## About this wiki

These pages are the topic-organised reference. The repo's `docs/` folder additionally contains a **per-phase
design record** (Phases 0–8) in both Markdown and Word, capturing why each part was built the way it is.
