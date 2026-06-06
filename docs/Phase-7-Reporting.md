# FSW Booking System — Phase 7: Reporting Dashboard

**Document version:** 1.0
**Date:** 2026-06-06
**Phase status:** Complete
**Audience:** Project owner / reviewer (and future developers)

---

## 1. Purpose of this document

This is the design-and-build record for **Phase 7**, the manager's reporting dashboard: how much of the time
each employee offered was actually booked, and what kinds of meetings filled it. It builds on all prior data
(availability, time off, bookings) and reuses the availability engine so the numbers are consistent with what
the rest of the system shows.

---

## 2. What the report shows

For a chosen **date range**:

- **Per employee:** booked hours, offered hours, **utilisation %** (with a small bar), and meeting count.
- **Company totals:** booked vs offered hours, overall utilisation, total meetings.
- **By meeting type:** total hours and meeting count for each type across the team.

The report opens on the last 30 days by default and can be re-run for any range.

---

## 3. How the numbers are computed

- **Offered hours (capacity)** = the time the employee made bookable — their recurring availability plus
  one-off additions, **minus** exceptions, time off and company closures — intersected with the date range.
  Crucially this is computed with the **same `computeFreeRanges` engine** used everywhere else, but with
  bookings excluded, so "offered" means *capacity made available*, not *capacity still free*.
- **Booked hours** = the duration of **confirmed** meetings within the range (clipped to the range edges so a
  meeting straddling the boundary only counts its in-range portion). Cancelled meetings are ignored.
- **Utilisation** = booked ÷ offered, shown as a percentage (and "—" when an employee offered no time, to
  avoid a divide-by-zero).
- **By type** sums booked hours and counts by each meeting's *type* label across all employees.

Reusing the engine matters: utilisation is measured against exactly the availability the system would have let
the manager book against — the report can't drift from reality.

### Performance

Each underlying tab is read **once** and filtered in memory (the usual rule — Sheet round-trips, not
computation, are the cost). For a 10-person team over typical ranges this is fast.

---

## 4. The interface

The manager's **Reports** tab has From/To date pickers and a **Run** button. Results render as a summary line,
a per-employee table (with a utilisation bar), and a by-type table. It runs automatically for the last 30 days
when the tab first loads.

### Files

- `src/Reporting.gs` — `getReport(fromDate, toDate)` (manager-only) and small aggregation helpers.
- `src/ui/Manager.html` — the Reports tab built out.
- `src/ui/JsManager.html` — the report rendering (tables + bars).
- `src/ui/Styles.html` — report table and bar styles.

No schema changes were needed.

---

## 5. How to verify

Push (`clasp push`). With some availability and a few bookings in place, open the manager **Reports** tab:

| Step | Expected |
|---|---|
| The tab auto-runs for the last 30 days | A summary line, a per-employee table, and a by-type table appear |
| An employee with availability but no bookings | Offered hours > 0, booked 0, utilisation 0% |
| Book a meeting, then re-run | That employee's booked hours and utilisation rise; the meeting's type appears in the by-type table |
| Cancel a meeting, then re-run | Its hours drop back out of the totals |
| Pick a range with no activity | Empty/zero figures, no errors |

A useful sanity check: an employee's **booked + still-free ≈ offered** for the range (buffers and rounding
aside), because offered is their capacity and booked is the part of it taken.

---

## 6. Notes and limitations (intentional)

- **Offered** capacity is measured before buffers (buffers only affect what's *bookable next to a meeting*,
  not how much time was offered), so utilisation reflects offered-vs-booked cleanly.
- Figures use confirmed meetings only; the full history (including cancellations) remains in the `Bookings`
  and `AuditLog` tabs if deeper analysis is ever needed.
- The dashboard is read-only and manager-only.

---

## 7. What's next

| Phase | Deliverable |
|---|---|
| **8** | **Deployment & Google Sites embedding** — the step-by-step deploy recipe (execute-as-me + domain access), embedding the app in your Google Site with the new-tab fallback, and a full user-acceptance test pass across all features |

Phase 8 will ship its own `.md` and `.docx` document and complete v1.
