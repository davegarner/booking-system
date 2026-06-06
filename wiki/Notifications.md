# Notifications

The FSW Booking System sends transactional email through Google Workspace (`MailApp`) — no third-party service and no extra cost. Emails go out when a meeting is **booked**, **rescheduled** or **cancelled**, and an automatic **reminder** is sent before each meeting.

All of this is best-effort: email is sent **after** the booking lock is released and is wrapped so that any mail failure is logged but **never affects the booking itself**. A meeting is saved whether or not its email goes out.

The relevant source lives in `src/Notifications.gs` (composition and sending), `src/Reminders.gs` (the scheduled reminder job) and `src/Triggers.gs` (installing the trigger). See also the design record in `docs/Phase-6-Notifications.md`.

Related pages: [[Booking and Concurrency]], [[Configuration]], [[Data Model]], [[Deployment]], [[API Reference]].

## What fires, and to whom

Booking events are emitted by the booking API after the lock is released (`createBooking`, `rescheduleBooking`, `cancelBooking` call `notifyBooking_`). Each event produces tailored, private-by-design messages — each recipient gets a message written for them, not one shared email.

| Event (`kind`) | Client | Employee | Manager(s) |
|---|---|---|---|
| `BOOK` | Confirmation | Operational details | Copied |
| `RESCHEDULE` | "Appointment has moved" (+ previous time) | Operational details | Copied |
| `CANCEL` | "Appointment has been cancelled" (+ reason if given) | Operational details | Copied |
| `REMINDER` | Reminder | "Upcoming appointment" | **Not** copied |

Key audience rules:

- **Client** gets a friendly confirmation. The message carries a **reply-to of the employee** (`empEmail`), so a client reply lands with the right person. The client email never exposes staff email addresses.
- **Employee** (the assigned `userId`) gets the operational details: client name, client email, client phone and any purpose notes.
- **Manager(s)** receive a copy of the staff-style email for oversight — for `BOOK`, `RESCHEDULE` and `CANCEL` only. A manager who is also the assigned employee is not double-emailed (`if (mgr !== empEmail)`).
- **Reminders** go to **client + employee only** (see [Manager-noise design choice](#manager-noise-design-choice)).

Managers are resolved by `managerEmails_()`, which reads the Users sheet and keeps active users whose role is `MANAGER` with a non-empty email. See [[Data Model]] and [[Security and Permissions]] for roles.

## Message content

`composeBookingEmail_(kind, audience, b, extra, tz)` returns `{ subject, html, text }`. Subjects are branded with the configured company name, e.g. for a client booking:

```
<companyName>: appointment confirmed — Tue 9 Jun, 14:30
```

The body rows are built by `bookingRows_`:

| Row | Client email | Staff/manager email |
|---|---|---|
| With (employee name) | yes | — |
| When (start–end, local time) | yes | yes |
| Format (In person / Phone / Video) | yes | yes |
| Type (meeting type, if set) | yes | yes |
| Client / Client email / Client phone | — | yes (when present) |
| Notes (purpose notes) | — | yes (when present) |
| Previously (old time) | reschedule only | reschedule only |
| Reason | cancel only | cancel only |

For a `RESCHEDULE`, the previous time is passed in via `extra.oldWhen` and shown as a leading **Previously** row. For a `CANCEL`, an optional `extra.reason` is appended as a **Reason** row.

The location/format label comes from `locLabelServer_` (mapping `LOCATION_FORMAT.IN_PERSON` → "In person", `.PHONE` → "Phone", `.VIDEO` → "Video"). Times are formatted in the system timezone (`getTz()`).

## HTML + plain text

Every message is sent as **both HTML and plain text**:

- `emailHtml_` builds a branded, inline-styled HTML body (company header, title, intro, a two-column detail table, and an "Automated message" footer).
- `emailText_` builds the plain-text fallback (title, intro, then `label: value` lines).

All user-supplied values in the HTML are escaped via `esc_` (`&`, `<`, `>`, `"`).

## Sending and the quota guard

`sendMail_(to, subject, htmlBody, textBody, replyTo)` is the single send path:

- Returns `false` immediately if `to` is not a valid email (`isValidEmail_`).
- Checks `MailApp.getRemainingDailyQuota()` first; if it is `<= 0` the send is **skipped and logged** rather than throwing.
- Sends with `MailApp.sendEmail`, using `fromName` from config (default `'FSW Booking'`) as the sender name, and attaches `replyTo` only when supplied.
- Any exception is caught and logged; it returns `false`. This keeps mail failures non-fatal.

`notifyBooking_` itself is also wrapped in `try/catch`, so the whole notification step can never throw back into a booking. See [[Booking and Concurrency]] for where this sits relative to the lock.

### Quota numbers

On a Workspace account the mail limit is generous — roughly **1,500 recipients/day**, pooled on the owner account. A single booking event is about three recipients (client, employee, one manager), so even a busy day for a small team stays comfortably within the limit. The quota guard in `sendMail_` exists to handle the edge case cleanly rather than because the limit is expected to bite.

## Reminders

A single **hourly time-driven trigger** runs `sendDueReminders()` (in `src/Reminders.gs`). On each run it:

1. Computes the horizon: `now + reminderLeadHours` (config value, falling back to `DEFAULTS.reminderLeadHours`), converted to milliseconds.
2. Reads bookings fresh (`readObjects(SHEETS.BOOKINGS, { noCache: true })`) and keeps rows that are:
   - status `CONFIRMED`,
   - **not** already reminded (`!truthy_(b.reminderSent)`),
   - starting in the future (`startMs > now`),
   - starting at or before the horizon (`startMs <= horizon`).
3. Calls `notifyBooking_(b, 'REMINDER', {})` for each (client + employee only).
4. Marks the row reminded: `updateById(... { reminderSent: true, reminderSentAt: now })`.

It returns the count sent and logs it when non-zero.

### De-duplication and reschedule reset

Marking `reminderSent` after sending is the de-dup mechanism — a meeting can never be reminded twice. Because rescheduling **resets `reminderSent`**, a moved meeting correctly gets a **fresh reminder** for its new time. The `reminderSent` / `reminderSentAt` fields are part of the Bookings schema (see [[Data Model]]).

Hourly resolution is deliberate: reminders fire "within the hour they're due" while staying well inside Apps Script's trigger limits.

### Manager-noise design choice

Reminders intentionally skip managers. In `notifyBooking_` the manager loop is gated by `if (kind !== 'REMINDER')`, with the comment that a daily manager copy of every reminder is noise. Booking / reschedule / cancel emails **do** copy managers. Enabling manager reminders is a one-line change in `Notifications.gs`.

## Installing the trigger

`installTriggers()` (in `src/Triggers.gs`) installs the hourly job. It is **idempotent**: it calls `removeTriggers()` first (deleting any existing trigger whose handler is `sendDueReminders`), then creates a fresh one:

```js
ScriptApp.newTrigger('sendDueReminders').timeBased().everyHours(1).create();
```

Re-running never stacks duplicates — important because Apps Script caps triggers per script. `setup()` calls `installTriggers()`, so the reminder job is live once setup has run. If trigger installation is ever skipped (e.g. a permissions hiccup), run `installTriggers()` once from the editor. See [[Deployment]] and [[Configuration]] for setup and the required mail scope (`script.send_mail`).

## Configuration

The reminder lead time is the **`reminderLeadHours`** config value (default applied via `DEFAULTS.reminderLeadHours` when unset). The sender name uses **`fromName`** and subjects/bodies use **`companyName`**. See [[Configuration]] for where these are stored and edited.

## Testing notes

To exercise reminders without waiting, either set `reminderLeadHours` high (e.g. `720`) so an upcoming meeting falls in range, or run `sendDueReminders` manually from the editor — a second run sends nothing because of de-duplication. Watch **View → Executions / Logs** for `sendDueReminders` output and any skipped-send messages. See [[Testing]] and [[Troubleshooting]] for more.
