# FSW Booking System

An internal client-booking system for a ~10-person team, built as a **Google Apps Script web app**
backed by **Google Sheets** and embedded in **Google Sites**. Employees set their own availability;
the manager books client meetings into it. No third-party services, runs entirely inside Google Workspace.

See the full design in `plans/` (or the approved implementation plan) for the rationale behind every decision.

## Status — v1 complete

All eight build phases are done. Per-phase write-ups (Markdown + Word) are in [docs/](docs/README.md).

| Area | Modules |
|---|---|
| Foundation | `Schema.gs`, `Config.gs`, `TimeUtil.gs`, `SheetDAL.gs`, `AuditLog.gs`, `AvailabilityEngine.gs`, `Setup.gs`, `Tests.gs` |
| Auth & shell | `Auth.gs`, `Code.gs`, `ui/Index.html`, `ui/Styles.html`, `ui/JsCommon.html`, `ui/Notice.html` |
| Employee | `AvailabilityApi.gs`, `ui/Employee.html`, `ui/JsEmployee.html` |
| Time off / closures | `TimeOffApi.gs` |
| Booking & lifecycle | `BookingApi.gs`, `ui/Manager.html`, `ui/JsManager.html` |
| Notifications | `Notifications.gs`, `Reminders.gs`, `Triggers.gs` |
| Reporting | `Reporting.gs` |

Run `runAllTests()` for the engine/booking unit tests (13). Verify each feature with the matrix in
[docs/Phase-8-Deployment.md](docs/Phase-8-Deployment.md).

## Data model (Google Sheet tabs)

`Config`, `Users`, `AvailabilityRules`, `AvailabilityAdditions`, `AvailabilityExceptions`, `TimeOff`,
`Closures`, `Bookings`, `AuditLog`. All instants are stored as **UTC epoch-millisecond integers**; all
recurring times are wall-clock in the one business timezone (`Config.timeZone`, default `Europe/London`).

## First-time setup

### Prerequisites
1. Install **Node.js** (LTS) and **clasp**:
   ```bash
   npm install -g @google/clasp
   # or, in this repo:  npm install   (clasp is a devDependency)
   ```
2. Enable the Apps Script API for your account: visit
   <https://script.google.com/home/usersettings> → turn **Google Apps Script API** **On**.
3. Sign in with the Workspace account that will **own** the project (this identity runs the app and
   sends all notification email):
   ```bash
   clasp login
   ```

### Create the script project
From the repo root:
```bash
clasp create --type webapp --title "FSW Booking" --rootDir src
```
This writes `.clasp.json` (your `scriptId`) and links the `src/` folder. Then push the code:
```bash
clasp push
```

> If you already have a script, run `clasp clone <scriptId> --rootDir src` instead, then `clasp push`.

### Initialise the data spreadsheet
1. Open the script editor: `clasp open`.
2. Run the **`setup`** function once (select it in the editor toolbar → Run). Approve the OAuth scopes
   when prompted (this is the one-time owner authorization).
3. `setup()` creates a spreadsheet named **"FSW Booking System — Data"**, builds every tab, seeds the
   `Config` defaults, and registers you as the first **manager**. The spreadsheet URL is printed to the
   execution log (View → Logs).

### Add your employees
Run from the editor (or call via `clasp run`):
```js
addEmployee('alex@yourdomain.com', 'Alex Smith');
addEmployee('sam@yourdomain.com',  'Sam Jones', { bufferMin: 30, recurrenceMode: 'MONTHLY' });
```
`role` defaults to `employee`. Pass `{ role: 'manager' }` to add another manager.

### Confirm the timezone
The default business timezone is `Europe/London`. To change it, edit the `timeZone` row in the `Config`
tab (use an IANA name, e.g. `Europe/Dublin`, `America/New_York`) **and** set the same zone on the script
project (`appsscript.json` → `timeZone`) and the data spreadsheet (File → Settings → Time zone).

## Verify the foundation

In the script editor, run **`runAllTests`**. It exercises the timezone conversions and the availability
engine (recurring expansion for weekly + monthly, buffer/time-off/closure subtraction, cancelled-booking
reopen) with in-memory data — no spreadsheet required. Check the log for `N/N passed`.

## Deployment & Google Sites embedding

Full details and the acceptance-test matrix are in [docs/Phase-8-Deployment.md](docs/Phase-8-Deployment.md).
In short:

1. **Deploy as a Web app.** In the editor: **Deploy → New deployment → Web app** (or `clasp deploy`), with:
   - **Execute as:** `Me (the owner)`
   - **Who has access:** `Anyone within <your domain>`

   This combination is required: it lets the app identify each visitor (so roles work) with only a one-time
   owner authorization, keeps the data Sheet private to the owner, and embeds cleanly in Google Sites.
2. **Copy the `/exec` URL** (not `/dev`). Re-deploying to the **same deployment** keeps that URL stable, so the
   Site embed never breaks — use `clasp deployments` and `clasp deploy --deploymentId <id>` to update in place.
3. **Embed in your Google Site:** edit the Site → **Insert → Embed → By URL** → paste the `/exec` URL. Publish
   the Site restricted to your Workspace domain.
4. **Add a fallback link** on the Site — a button "Open Booking System in a new tab" pointing at the `/exec`
   URL — for the rare locked-down browser that blocks third-party iframes. (The app already sets the two
   iframe-safety flags: `ALLOWALL` and `<base target="_top">`.)

## Documentation

Each build phase ships a comprehensive write-up in `docs/`, in both Markdown and Word formats (see
[docs/README.md](docs/README.md)). Rebuild the `.docx` files from their `.md` sources with
`tools/build-docs.sh`.

## Project layout

```
FSW-Booking-System/
  package.json        # clasp scripts + devDependencies
  .claspignore        # only src/ is pushed
  .clasp.json         # scriptId (generated by `clasp create`; git-ignored by default)
  README.md
  docs/               # per-phase documentation (.md sources + generated .docx)
  tools/              # md2docx.py + build-docs.sh (NOT pushed to Apps Script)
  src/
    appsscript.json   # manifest: timezone, V8, webapp{access:DOMAIN, executeAs:USER_DEPLOYING}, scopes
    Schema.gs  Config.gs  TimeUtil.gs  SheetDAL.gs  AuditLog.gs
    AvailabilityEngine.gs  Setup.gs  Tests.gs
    Code.gs  Auth.gs  AvailabilityApi.gs  BookingApi.gs  TimeOffApi.gs
    Notifications.gs  Reminders.gs  Triggers.gs  Reporting.gs
    ui/  Index.html Styles.html JsCommon.html Notice.html
         Employee.html JsEmployee.html  Manager.html JsManager.html
```
