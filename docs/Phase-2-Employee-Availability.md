# FSW Booking System — Phase 2: Employee Availability

**Document version:** 1.0
**Date:** 2026-06-06
**Phase status:** Complete
**Audience:** Project owner / reviewer (and future developers)

---

## 1. Purpose of this document

This is the design-and-build record for **Phase 2**, the first feature employees actually use: the screen
where each person sets the times they're free to take clients. It builds on the Phase 0 foundation (the data
model and availability engine) and the Phase 1 shell (sign-in, the employee view, the client↔server channel).

After this phase, an employee can fully describe their availability and *see* exactly what they're offering;
the manager's booking screen (Phase 4) will be built directly on top of this data.

---

## 2. What an employee can now do

On the **My availability** tab, an employee can:

1. **Set a buffer** — the gap automatically kept clear before and after each of their meetings.
2. **Add recurring availability** — repeating patterns, either:
   - **Weekly** — e.g. *"Every Tuesday, 09:00–17:00"*, or
   - **Monthly** — either *"Day 15 of each month"* or *"the 2nd Tuesday / last Friday of each month"*.
3. **Add one-off slots** — extra availability on a specific date, on top of the recurring pattern.
4. **Add exceptions** — remove part of their normal availability on a specific date ("not this Monday
   morning").
5. **Preview** — see their actual bookable free time for any date range, computed by the engine after
   subtracting everything (exceptions, time off, closures, and — once bookings exist — meetings and buffers).

Everything saves immediately and reloads, so the lists always reflect the true stored state.

---

## 3. How it works

### 3.1 The server API (`AvailabilityApi.gs`)

A small set of client-callable functions, each guarded so an employee can only act on **their own**
calendar (the manager may act for anyone — enforced by `requireSelfOrManager`):

| Function | Purpose |
|---|---|
| `getEmployeeAvailability(userId)` | Everything the screen needs in one call: the user's buffer, recurring rules, upcoming one-off slots and exceptions, and the timezone |
| `saveRule(userId, rule)` | Create or update a recurring rule (validated) |
| `deleteRule(userId, ruleId)` | Remove a recurring rule |
| `addOneOff` / `deleteOneOff` | Manage one-off availability |
| `addException` / `deleteException` | Manage exceptions |
| `setBuffer(userId, minutes)` | Update the personal buffer |
| `previewFreeRanges(userId, fromDate, toDate)` | Compute and return bookable free time for a date range |

### 3.2 Timezone is handled on the server

The browser only ever sends plain calendar values — a date like `2026-06-15`, a time like `09:00`. The
server interprets these as **business-timezone wall-clock** and converts them to the canonical epoch-ms
storage using the Phase 0 `TimeUtil` helper. This means a person in a different timezone (or a browser set to
one) can never accidentally store the wrong instant — the business timezone is the single reference.

### 3.3 Validation

Every input is checked on the server before anything is written: a valid frequency, a real weekday or
day-of-month, an end time after the start time, a buffer within 0–600 minutes, and a sensible preview range.
Bad input is rejected with a clear, human-readable message that the screen shows as a toast.

### 3.4 Edits are reversible and audited

Removals are **soft** (the row is marked inactive, not erased) and every create/update/delete writes an entry
to the append-only audit log, so the history of who changed what is preserved.

### 3.5 The preview reuses the real engine

The preview does not approximate — it calls the exact same `computeFreeRanges` function the manager's booking
screen will use. So what an employee sees in the preview is precisely what the manager will be able to book
against. This is the quickest way for an employee to sanity-check their own setup.

---

## 4. The user interface

The **My availability** tab is organised into clear cards: *Buffer*, *Recurring availability*, *One-off
availability*, *Exceptions*, and *Preview*. Each list shows existing entries with a **Remove** button; each
"+ Add…" control expands an inline form. The recurring form adapts as you choose: picking *Weekly* shows a
weekday selector; picking *Monthly* shows either a day-of-month box or an occurrence + weekday pair.

Recurring patterns are rendered in plain English (e.g. *"Every Tuesday, 09:00–17:00"*, *"Last Friday of each
month, 13:00–14:00"*) so the list is readable at a glance.

### Files

- `src/AvailabilityApi.gs` — the server API described above.
- `src/ui/Employee.html` — the *My availability* tab markup (calendar and time-off tabs remain placeholders).
- `src/ui/JsEmployee.html` — the client logic (rendering, forms, save/delete, preview). Loaded only on the
  employee view.
- `src/ui/Styles.html` — extended with styles for buttons, inputs, forms, lists, and the preview.

---

## 5. How to verify

Push (`clasp push`) and open the app as an employee (add a test employee, or set your own `Users` row's role
to `employee`). On **My availability**:

| Step | Expected result |
|---|---|
| Set the buffer to e.g. 15 and Save | "Buffer saved." toast; the value persists on reload |
| Add *Weekly · Tuesday · 09:00–17:00* | Appears in the recurring list as "Every Tuesday, 09:00–17:00" |
| Add *Monthly · Nth weekday · 2nd · Tuesday · 13:00–14:00* | Appears as "2nd Tuesday of each month, 13:00–14:00" |
| Add a one-off slot for a future date | Appears under one-off availability |
| Add an exception over part of a recurring day | Appears under exceptions |
| Preview the next two weeks | Free time is listed per day; the exception's hours are missing from that day, confirming subtraction works |
| Remove any entry | Disappears after confirmation; preview updates accordingly |

> Cross-check against the engine's unit tests from Phase 0 (`runAllTests`) — the preview and those tests share
> the same `computeFreeRanges` code path.

---

## 6. Notes and limitations (intentional, for now)

- Recurring rules are **open-ended** (no start/end-date bounds in the form yet); the data model already
  supports effective-date windows if needed later.
- The availability editor lives in the **employee** view. If a manager also takes clients, they would be added
  with an employee role to get this screen.
- One-off slots and exceptions show **upcoming** entries (past ones are hidden to reduce clutter; they remain
  in the data and audit log).

---

## 7. What's next

| Phase | Deliverable |
|---|---|
| **3** | **Time off & company closures** — employees and the manager block out unavailable time; the manager can close the whole company at once; bookings caught under new time off get flagged |
| 4 | Manager booking — the combined calendar and booking flow, built on this availability data |
| 5 | Reschedule & cancel |

Phase 3 will ship its own `.md` and `.docx` document.
