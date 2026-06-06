# Getting Started

This is the **administrator install guide** for the FSW Booking System — a Google Apps Script
web app backed by Google Sheets, designed for a small (~10-person) team. Follow it once, in order,
to stand up a working instance: install the tooling, push the code, create the data spreadsheet,
add your people, and confirm the timezone.

For the architecture behind it see [[Architecture]]; for putting the app live and embedding it in a
Google Site see [[Deployment]]; for tuning settings afterwards see [[Configuration]].

> **Who runs this?** A single Google Workspace **owner account** that will own the script *and* the
> data spreadsheet. This identity runs the app and **sends all notification email** — see
> [[Security and Permissions]] for why that matters.

---

## 1. Prerequisites

| Requirement | How |
|---|---|
| **Node.js** (LTS) | Install from your usual source; needed only for the `clasp` tool. |
| **clasp** | `npm install -g @google/clasp` (or `npm install` in this repo — clasp is a devDependency). |
| **Apps Script API enabled** | Visit <https://script.google.com/home/usersettings> and turn **Google Apps Script API** **On**. |
| **Owner sign-in** | `clasp login`, signed in as the Workspace account that will own the project. |

Install clasp and log in:

```bash
npm install -g @google/clasp
# or, from the repo root:  npm install

clasp login
```

The account you authorize in `clasp login` becomes the owner. Because the deployed app **executes
as the owner** and email is sent from that account, choose this account deliberately.

---

## 2. Create the script project and push the code

From the repo root, create a new web-app script linked to the `src/` folder:

```bash
clasp create --type webapp --title "FSW Booking" --rootDir src
```

This writes `.clasp.json` (containing your `scriptId`) and links `src/`. Then push the code up:

```bash
clasp push
```

> **Already have a script?** Run `clasp clone <scriptId> --rootDir src` instead of `clasp create`,
> then `clasp push`.

Only `src/` is pushed (the `.claspignore` keeps `docs/` and `tools/` out of Apps Script).

---

## 3. Run `setup()` to create the data spreadsheet

Open the script editor and run the bootstrap function once:

```bash
clasp open
```

In the editor toolbar, select **`setup`** and click **Run**. Approve the OAuth scopes when prompted
— this is the one-time owner authorization.

`setup()` is **idempotent** (safe to re-run): it never overwrites existing Config rows or users, and
only adds missing tabs. On first run it:

- **Creates the data spreadsheet** named **"FSW Booking System — Data"** (and stores its id in script
  properties so it is reused on later runs).
- **Builds every tab** with the correct bold, frozen header row and column formats:
  `Config`, `Users`, `AvailabilityRules`, `AvailabilityAdditions`, `AvailabilityExceptions`,
  `TimeOff`, `Closures`, `Bookings`, `AuditLog`. See [[Data Model]] for what each holds.
- **Seeds `Config` defaults** (only if the Config tab is empty) — see [[Configuration]].
- **Registers the running user as the first manager** (only if `Users` is empty), with a default
  buffer, weekly recurrence mode, and a colour.
- **Installs the hourly reminder trigger** (`installTriggers()`, best-effort). If it could not install
  automatically, the log says so — re-run `installTriggers()` manually. See [[Notifications]].

The data spreadsheet URL and the seeded manager email are written to the execution log
(**View → Logs**). You can re-print the URL any time with `getDataSpreadsheetUrl()`.

---

## 4. Add your employees

Run `addEmployee(...)` from the editor (or via `clasp run`) once per person:

```js
addEmployee('alex@yourdomain.com', 'Alex Smith');
addEmployee('sam@yourdomain.com',  'Sam Jones', { bufferMin: 30, recurrenceMode: 'MONTHLY' });
```

### `addEmployee(email, displayName, options)`

| Argument | Required | Notes |
|---|---|---|
| `email` | Yes | The user's Workspace login email. Throws if blank, or if the email already exists. |
| `displayName` | No | Defaults to the part of the email before `@`. |
| `options` | No | Object of optional overrides (see below). |

**`options` fields:**

| Option | Default | Purpose |
|---|---|---|
| `role` | `'employee'` | Pass `{ role: 'manager' }` to add another manager. |
| `bufferMin` | `Config.defaultBufferMin` | Gap (minutes) enforced around this person's meetings. See [[Booking and Concurrency]]. |
| `recurrenceMode` | `'WEEKLY'` | How this person's recurring availability is expressed (`WEEKLY` or `MONTHLY`). See [[Availability Engine]]. |
| `colorHex` | auto-picked | Calendar lane colour; chosen from a palette if omitted. |

The function returns the new `userId` and logs the role and email. To **remove** someone later,
set their `Users` row `active` to `FALSE` (history and past bookings are preserved) rather than
deleting the row.

For full signatures of these and other server functions, see [[API Reference]].

---

## 5. Confirm the timezone

The system runs in **one business timezone**. The default is `Europe/London`. All instants are stored
as UTC epoch-millisecond integers, while recurring times are wall-clock in this one zone — so getting
the zone right matters.

To change it, set the **same** IANA zone name in **all three** places:

1. The `timeZone` row in the **`Config`** tab (e.g. `Europe/Dublin`, `America/New_York`).
2. The script project — `appsscript.json` → `timeZone`.
3. The data spreadsheet — **File → Settings → Time zone**.

See [[Configuration]] for the rest of the settings (`defaultBufferMin`, `bookingHorizonDays`,
`reminderLeadHours`, etc.).

---

## 6. Verify the foundation

Before going live, sanity-check the engine. In the script editor, select and run **`runAllTests`**.
It exercises timezone conversions and the availability engine (weekly + monthly recurring expansion,
buffer / time-off / closure subtraction, cancelled-booking reopen) entirely in memory — no
spreadsheet required. Check the log for `13/13 passed`.

See [[Testing]] for what each test covers.

---

## 7. Quick install checklist

- [ ] Node + clasp installed; Apps Script API enabled.
- [ ] `clasp login` done as the **owner** account.
- [ ] `clasp create --type webapp --title "FSW Booking" --rootDir src` run.
- [ ] `clasp push` succeeded.
- [ ] `setup()` run once; OAuth scopes approved; spreadsheet URL noted from the log.
- [ ] Manager seeded (the account that ran `setup()`); employees added with `addEmployee(...)`.
- [ ] Timezone confirmed in `Config`, `appsscript.json`, and the spreadsheet settings.
- [ ] Reminder trigger present (from `setup()` or a manual `installTriggers()`).
- [ ] `runAllTests()` shows `13/13 passed`.

---

## What's next

You now have a configured backend, but the app is **not yet reachable** by your team. Continue with
[[Deployment]] to deploy the web app (Execute as **Me**, access **Anyone within your domain**), copy
the stable `/exec` URL, and embed it in your Google Site.

Once live, point users at the [[Employee Guide]] and the [[Manager Guide]]. If anything misbehaves,
see [[Troubleshooting]].
