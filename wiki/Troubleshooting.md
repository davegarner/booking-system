# Troubleshooting

Practical fixes for the most common problems with the FSW Booking System. Each
entry gives the symptom, the likely cause, and what to do. If you are setting the
system up for the first time, start with [[Getting Started]] and
[[Deployment]]; for what each setting does, see [[Configuration]].

Many issues come down to four things: **setup hasn't run**, the visitor **isn't
on the roster**, a **timezone mismatch**, or a browser that **blocks iframes**.

---

## "Setup required" notice

**Symptom:** Opening the app shows a notice titled *"Setup required"* (not an
error page).

**Cause:** `doGet` tried to read the roster and failed — almost always because
`setup()` has never been run, so the data spreadsheet doesn't exist or isn't
linked. Internally the Sheet id lives in Script Properties; without it the data
layer throws *"SHEET_ID is not set. Run Setup.setup() once..."*.

**Fix:**
1. Open the Apps Script editor.
2. Run `setup()` once. This creates the data spreadsheet, seeds `Config` and the
   first manager, and installs the reminder trigger.
3. Add staff with `addEmployee("email@domain", "Full Name")`.
4. Reload the app.

See [[Getting Started]] and [[Deployment]] for the full first-run sequence.

---

## "No access" notice

**Symptom:** A signed-in user sees a notice titled *"No access"* that names their
email and says they are *"not on the FSW Booking roster."*

**Cause:** The Google account opening the app is not an **active** user in the
`Users` tab — or they signed in with the wrong account (e.g. a personal Gmail, or
an account outside your Workspace domain). The server re-derives identity from the
Google session every time and only authorises rostered users (see
[[Security and Permissions]]).

**Fix:**
- Confirm the user is signed in with their **Workspace domain account**, not a
  personal one. In Google Sites embeds, the active Google account in that browser
  profile is what's used.
- Have a manager add them: `addEmployee("email@domain", "Full Name")`.
- If they were deactivated, set their `Users` row `active` back to `TRUE`. (To
  remove someone you set `active` to `FALSE`; their history is preserved — see
  [[Data Model]].)
- The email shown in the notice is the exact account the server saw — check it
  matches the one you added.

---

## Blank frame or a sign-in box inside Google Sites

**Symptom:** Inside the Google Site the booking app shows a blank area or just a
Google sign-in prompt, even though the user is signed in.

**Cause:** A minority of browsers block **all third-party cookies/iframes**. The
app already sends the two flags needed for framing —
`setXFrameOptionsMode(ALLOWALL)` and `<base target="_top">` so links can escape
the sandbox — but those flags can't override a browser that refuses cross-origin
frames outright.

**Fix:**
- Use the **"Open Booking System in a new tab"** fallback link. It loads the app
  directly (no cross-origin frame), so it always works. Every embed should have
  this link added next to it — see [[Deployment]].
- Make sure the embed uses the **`/exec`** URL, never `/dev`. `/dev` only works
  for script editors and serves unsaved code.
- Confirm the Site is published to an audience **restricted to your Workspace
  domain**, matching the app's *"Anyone within `<domain>`"* access setting.
- As a per-user workaround, the affected browser can allow third-party cookies
  for the site, but the new-tab link is the supported answer.

---

## Times look an hour (or several hours) off

**Symptom:** Free times, bookings, or email times are shifted from what you
expect — often by exactly one hour.

**Cause:** A **timezone mismatch**. The system has three places that must agree:
the `timeZone` value in the `Config` tab, the Apps Script project timezone, and
the data spreadsheet's timezone. A one-hour shift is usually **DST** (daylight
saving) — one of the three is on a fixed offset while the others observe DST, or
they're set to different regions.

**Fix:**
1. Open the `Config` tab and confirm `timeZone` is your business timezone
   (e.g. an IANA name like `Europe/London`).
2. Match the **Apps Script project** timezone to it (editor → Project Settings).
3. Match the **spreadsheet** timezone to it (File → Settings in the Sheet).
4. Reload. The status line at the top of the app shows the **server time** —
   compare it to a clock in your timezone to confirm.

All three should name the **same region** so DST transitions happen together. See
[[Configuration]] for the `Config` keys and [[Availability Engine]] for how times
are computed.

---

## Confirmation / reschedule / cancel emails not arriving

**Symptom:** A booking succeeds but the client, employee, or manager doesn't
receive the email.

**Causes & fixes:**

| Cause | How to tell | Fix |
|---|---|---|
| **Invalid client email** | Client never gets mail; employee/manager do | The send is skipped when the address fails validation. Re-check the client email and reschedule or re-send. |
| **Spam / filtering** | Nothing in inbox | Check spam/quarantine; allowlist the sender (`fromName` is `FSW Booking` by default). |
| **Email quota hit** | Whole batch missing; editor logs show *"Email quota exhausted; skipped..."* | Workspace allows ~1,500 recipients/day on the owner account. The code checks `MailApp.getRemainingDailyQuota()` and skips + logs when it's zero. Wait for the daily reset. |
| **Scope not authorised** | Sends fail right after a code change | Re-open a deployment and re-authorise the requested scopes (Sheets, send-mail, user email, triggers) — see [[Deployment]]. |
| **Manager copy missing for reminders** | Managers get BOOK/RESCHEDULE/CANCEL but not reminders | By design: reminders go to **client + employee only** to avoid daily noise. This is intentional, not a fault. |

Email is best-effort: it is sent **after** the booking lock is released and is
wrapped in try/catch, so an email failure never blocks or undoes a booking. Any
failure is written to the editor logs (`Logger.log`). For the full delivery
matrix see [[Notifications]].

---

## Reminders not firing

**Symptom:** Clients and employees don't get the reminder before their
appointment.

**Cause:** The hourly trigger that runs `sendDueReminders` is missing (triggers
can be dropped if the project is re-created or scopes change), or the lead time is
wrong.

**Fix:**
- Re-install the trigger by running **`installTriggers()`** in the editor. The
  reminder trigger is also installed during `setup()`.
- Check `reminderLeadHours` in the `Config` tab — reminders only go out once an
  appointment is within that many hours.
- You can run `sendDueReminders` manually in the editor to test. Each reminder is
  sent once: a second run sends nothing for the same appointments.

See [[Notifications]] and [[Configuration]].

---

## "The system is busy, please try again in a moment."

**Symptom:** An action (usually a booking) fails with this message.

**Cause:** **Lock contention.** The booking write-path is serialised with
`LockService` so two bookings can't run at once. If another request holds the
lock longer than `lockTimeoutMs`, the waiting request gives up with this message.
It is rare.

**Fix:**
- Simply **try again in a moment** — the message means it's working as designed,
  not that anything is broken.
- If it happens often, raise `lockTimeoutMs` in `Config`, though the default is
  ample for a small team.

See [[Booking and Concurrency]].

---

## "Can two people book the same slot? (Double-booking)"

**Short answer: no — it is prevented by design.**

The booking critical section runs inside `withScriptLock`, which:

- takes the **script lock** so only one booking executes at a time;
- calls `SpreadsheetApp.flush()` on entry so it reads the **freshest committed**
  data before validating;
- re-checks availability and existing meetings *inside* the lock; and
- flushes again before releasing, so the next holder reads the committed result.

So two near-simultaneous bookings of one slot resolve to **exactly one success**;
the other is rejected ("not free"). This is verified by the UAT matrix (book an
overlap → rejected; two simultaneous → one wins). Details in
[[Booking and Concurrency]].

---

## Bookings rejected as "not free" when the slot looks open

**Symptom:** A time that appears free is rejected.

**Causes:**
- The slot falls inside another meeting's **buffer** (`defaultBufferMin`), which
  is reserved around each meeting.
- **Time off** or a **company closure** covers the time.
- The date is beyond `bookingHorizonDays`, or there's no matching availability
  pattern for that day.

**Fix:** Use *show free times* to see the genuinely bookable slots; adjust the
buffer/horizon in `Config` if the policy is wrong. See [[Availability Engine]]
and [[Configuration]].

---

## A meeting shows an amber outline / appears in "Conflicts to review"

**Symptom:** An existing meeting is outlined amber and listed under *Conflicts to
review*.

**Cause:** Time off or a closure was added **over** an existing booking. The
system flags rather than silently deletes, so a human decides what to do.

**Fix:** Reschedule or cancel the flagged meeting; the amber flag and the conflict
entry clear once resolved. See [[Manager Guide]].

---

## After a code change, the app behaves oddly or shows old code

**Symptom:** Fixes don't appear, or the embedded app differs from the editor.

**Causes & fixes:**
- You're viewing the **`/dev`** URL (unsaved/editor-only code) instead of
  **`/exec`**. Embeds and users must use `/exec`.
- You pushed code but didn't update the deployment. Run `clasp push`, then update
  the **same** deployment so the `/exec` URL stays stable (re-deploy in place;
  see [[Deployment]]).
- Stale cached reads: hot tabs are cached briefly in `CacheService` and
  invalidated on every write, so data is at most `cacheTtlSec` old. Reload after
  a moment if you edited the Sheet directly.

---

## Diagnostics & where to look

- **Status line** at the top of the app shows the signed-in email, role, and
  **server time** — your first check for identity and timezone problems.
- **`getServerInfo()`** (run in the editor or called by the shell) returns
  `email`, `role`, `authorized`, `tz`, and the server time — a quick
  identity/connectivity probe.
- **Editor execution logs** (`Logger.log`) record skipped/failed emails and other
  best-effort errors.
- **`AuditLog` tab** records every BOOK / RESCHEDULE / CANCEL / FLAG with who and
  when (see [[Data Model]]).
- **`runAllTests()`** in the editor should report `13/13 passed`; a failure points
  at the broken area — see [[Testing]].

For deeper internals, see [[Architecture]], the [[Developer Guide]], and the
[[API Reference]]. Back to [[Home]].
