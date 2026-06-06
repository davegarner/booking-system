# FSW Booking System — Phase 8: Deployment, Google Sites Embedding & Acceptance

**Document version:** 1.0
**Date:** 2026-06-06
**Phase status:** Complete (v1)
**Audience:** Project owner / administrator (and future developers)

---

## 1. Purpose of this document

This is the final build record. It covers how to put the system live — deploying the web app, embedding it in
your Google Site — and a complete **user-acceptance test (UAT) matrix** that exercises every feature end to
end. With this phase the v1 system is complete.

---

## 2. Prerequisites (recap)

- A Google Workspace **owner account** that will own the script and the data spreadsheet (it runs the app and
  sends all email).
- Node + clasp installed; the Apps Script API enabled; `clasp login` done as the owner (see the project
  `README.md`).
- The code pushed (`clasp push`) and `setup()` run once (creates the data spreadsheet, seeds Config and the
  first manager, installs the reminder trigger).
- Staff added with `addEmployee("email@domain", "Full Name")`.
- The business **timezone** confirmed in the `Config` tab (and matched on the script + spreadsheet).

---

## 3. Deploying the web app

1. In the Apps Script editor: **Deploy → New deployment → select type Web app**
   (or from the CLI: `clasp deploy --description "v1"`).
2. Set:

   | Setting | Value | Why |
   |---|---|---|
   | **Execute as** | **Me** (the owner) | One-time owner authorization; the data Sheet is never shared with staff; the app still sees each visitor's identity via the same-domain rule |
   | **Who has access** | **Anyone within `<your domain>`** | Restricts to your Workspace; required for identity to resolve and for clean iframe embedding |

3. Authorize the requested scopes once (Sheets, send-mail, user email, script triggers).
4. Copy the **Web app URL ending in `/exec`** (use `/exec`, never `/dev` — `/dev` only works for editors and
   serves unsaved code).

> **Keep the URL stable.** Re-deploy to the *same* deployment after code changes so the URL doesn't change and
> your Site embed keeps working: `clasp deployments` to list, then
> `clasp deploy --deploymentId <id> --description "v1.1"` to update in place. (In the editor: **Manage
> deployments → edit (pencil) → New version**.)

---

## 4. Embedding in Google Sites

1. Edit your Google Site → **Insert → Embed → By URL** → paste the **`/exec`** URL → Insert.
2. Size the embed block generously; the app manages its own scrolling.
3. **Publish** the Site to an audience **restricted to your Workspace domain** (so it matches the app's access).
4. Add a visible **fallback link/button** elsewhere on the page: *"Open Booking System in a new tab"* pointing
   at the same `/exec` URL, `target="_blank"`.

**Why the fallback?** The app already sends the two flags needed for framing (`ALLOWALL`, and
`<base target="_top">` so links can escape the sandbox). The embed works for normal signed-in users. But a
minority of browsers that block all third-party cookies/iframes may show a blank or sign-in frame — those
users click the new-tab link, which always works because it loads the app directly (no cross-origin frame).

---

## 5. Ongoing maintenance

- **Code changes:** `clasp push`, then update the pinned deployment (above). Test on the `/dev` URL first.
- **Settings:** edit the `Config` tab (timezone, `defaultBufferMin`, `bookingHorizonDays`, `reminderLeadHours`).
- **Add/inactivate staff:** `addEmployee(...)`; to remove someone, set their `Users` row `active` to `FALSE`
  (history and past bookings are preserved).
- **Reminders:** an hourly trigger runs `sendDueReminders`. If it ever stops, re-run `installTriggers()`.
- **Email quota:** Workspace allows ~1,500 recipients/day on the owner; far above this team's needs. The code
  skips and logs sends if the quota is ever hit.
- **Backups:** the data lives in one Google Sheet — use Google's version history, or File → Make a copy.

---

## 6. Security recap

- The app runs as the owner, so the server **never trusts the browser** about identity: every server function
  re-derives the user from the Google session and re-checks the role (`requireManager` /
  `requireSelfOrManager`).
- Employees can only read/change their own availability, time off, and meetings; the manager can act for
  anyone; clients have no access at all.
- Every change is recorded in the append-only `AuditLog`.

---

## 7. User-acceptance test (UAT) matrix

Run through this after deploying. Use two accounts where possible (a manager and an employee), and test both
**inside the Google Site iframe** and via the **direct `/exec` URL**.

### Setup & access
| # | Step | Expected |
|---|---|---|
| 1 | Open the app before `setup()` | "Setup required" notice (no error page) |
| 2 | Open as the owner after setup | Manager view; status line shows your email + "manager" + server time |
| 3 | Open as an added employee | Employee view |
| 4 | Open as an account not on the roster | "No access" notice naming the email |
| 5 | `runAllTests()` in the editor | `13/13 passed` |

### Employee — availability (Phase 2)
| # | Step | Expected |
|---|---|---|
| 6 | Set a buffer and Save | Persists on reload |
| 7 | Add a weekly and a monthly recurring pattern | Listed in plain English |
| 8 | Add a one-off slot and an exception | Listed; preview reflects them |
| 9 | Preview a date range | Free time per day; exception hours absent |

### Time off & closures (Phase 3)
| # | Step | Expected |
|---|---|---|
| 10 | Employee adds full-day and partial time off | Listed; preview loses that time |
| 11 | Manager adds a company closure | Listed under closures |
| 12 | Manager adds time off for an employee | Listed under that employee |

### Booking (Phase 4)
| # | Step | Expected |
|---|---|---|
| 13 | Manager: Book → show free times → fill client + valid email → Book | Appears on the Schedule calendar |
| 14 | Book an overlapping time for the same employee | Rejected ("not free") |
| 15 | Book inside an existing meeting's buffer | Rejected |
| 16 | Two near-simultaneous bookings of one slot | Exactly one succeeds |
| 17 | Add time off over an existing meeting | Meeting outlined amber; appears in *Conflicts to review* |

### Reschedule & cancel (Phase 5)
| # | Step | Expected |
|---|---|---|
| 18 | Manager reschedules a meeting to a valid time | Moves; old time frees up |
| 19 | Reschedule onto a clash | Rejected; meeting unchanged |
| 20 | Cancel with a reason | Removed from calendar; time reopens |
| 21 | Reschedule/cancel a flagged meeting | Amber flag and conflict entry clear |
| 22 | Employee reschedules/cancels their own meeting from *My calendar* | Works; cannot touch another's meeting |
| 23 | `AuditLog` tab | BOOK / RESCHEDULE / CANCEL / FLAG entries with who & when |

### Notifications (Phase 6)
| # | Step | Expected |
|---|---|---|
| 24 | Book with your address as the client | Client, employee, manager emails arrive |
| 25 | Reschedule / cancel | Emails arrive (old→new; cancel reason) |
| 26 | Set `reminderLeadHours` high (or run `sendDueReminders`) | Client + employee reminder; a second run sends nothing |

### Reporting (Phase 7)
| # | Step | Expected |
|---|---|---|
| 27 | Reports tab (last 30 days) | Per-employee booked/offered/utilisation + by-type tables |
| 28 | Book then re-run | Booked hours & utilisation rise; type appears |

### Embedding (Phase 8)
| # | Step | Expected |
|---|---|---|
| 29 | Open the app inside the Google Site | Renders correctly |
| 30 | Click the new-tab fallback link | Opens the app directly |

---

## 8. Going-live checklist

- [ ] `clasp push` and `setup()` run; manager + employees added.
- [ ] Timezone confirmed in `Config` (and on the script + spreadsheet).
- [ ] Web app deployed (Execute as **Me**, access **Anyone within domain**); `/exec` URL noted and pinned.
- [ ] Reminder trigger present (`installTriggers()` / from setup).
- [ ] Embedded in the Google Site + fallback link added; Site published to the domain.
- [ ] UAT matrix passed (at least the booking, conflict, notification and reporting rows).

---

## 9. v1 complete — possible future enhancements

The system meets all the agreed requirements. Natural next steps, if wanted later:

- **Google Calendar sync** (mirror bookings into employees' Outlook/Google calendars) — easy in this
  ecosystem; deliberately deferred.
- **Recurring client meetings** (book the same client on a repeating schedule in one action) — deferred in
  planning.
- **In-app roster editing** (add/deactivate staff without the editor).
- **Archiving** old bookings to keep the hot data small as years accumulate.
- **SMS reminders** (would need a paid gateway).

Each per-phase document (Phases 0–8) records the design and rationale for that part of the system; together
they are the maintenance manual for v1.
