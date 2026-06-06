# Deployment

How to put the FSW Booking System live: deploy the Apps Script as a web app with
the exact settings the design depends on, pin the deployment so the embed URL
never changes, embed it in Google Sites, and redeploy safely after code changes.

This page assumes you have already completed the first-time setup (project
created, code pushed, `setup()` run, staff added, timezone confirmed). If you
have not, start with [[Getting Started]]. If anything misbehaves after going
live, see [[Troubleshooting]].

---

## Before you deploy

You should have, from [[Getting Started]]:

- A Google Workspace **owner account** that owns the script and the data
  spreadsheet (it runs the app and sends all email).
- Node + `clasp` installed, the Apps Script API enabled, and `clasp login` done
  as the owner.
- Code pushed (`clasp push`) and `setup()` run once (this creates the
  *"FSW Booking System — Data"* spreadsheet, seeds `Config`, registers you as the
  first manager, and installs the reminder trigger).
- Staff added with `addEmployee("email@domain", "Full Name")`.
- The business **timezone** confirmed in the `Config` tab and matched on the
  script project and the spreadsheet.

---

## The web-app deploy settings

Deploy from the Apps Script editor — **Deploy → New deployment → select type
Web app** — or from the CLI with `clasp deploy --description "v1"`. Set:

| Setting | Value | Why |
|---|---|---|
| **Execute as** | **Me** (the owner) | One-time owner authorization; the data Sheet is never shared with staff; the app still sees each visitor's identity via the same-domain rule. |
| **Who has access** | **Anyone within `<your domain>`** | Restricts to your Workspace; required for identity to resolve and for clean iframe embedding. |

These two values are not arbitrary — they are baked into the manifest
(`src/appsscript.json`):

```json
"webapp": {
  "access": "DOMAIN",
  "executeAs": "USER_DEPLOYING"
}
```

### Why this combination

- **Execute as Me + private Sheet.** The app runs as the owner, so the data
  spreadsheet is never shared with staff. Only one person (the owner) authorizes
  the scopes, once. The server never trusts the browser about who you are: every
  request re-derives the user from the Google session and re-checks the role. See
  [[Security and Permissions]].
- **Anyone within domain → identity works.** Because access is restricted to your
  Workspace domain, Apps Script can resolve each visitor's email, which is how the
  app picks the right view — manager, employee, or a "No access" notice for an
  account that is not on the roster.
- **Clean iframe embedding.** The same-domain rule is also what lets the app
  render cleanly inside a Google Sites iframe published to the same domain.

When you create the deployment, **authorize the requested scopes once** — Sheets,
send-mail, user email, and script triggers (`spreadsheets`, `script.send_mail`,
`userinfo.email`, `script.scriptapp`).

---

## `/exec` vs `/dev`

The deployment gives you a **Web app URL ending in `/exec`** — copy that one.

| URL | Use it for | Notes |
|---|---|---|
| `…/exec` | **Production** — the embed URL and the shared link | Serves the last *deployed* version. This is what goes in Google Sites. |
| `…/dev` | **Testing only** | Works for editors only and serves the latest *saved* (possibly unsaved/unversioned) code. Never embed or share this. |

Use `/exec` for the Site embed and the fallback link; use `/dev` to sanity-check
code changes before you redeploy.

---

## Pinning the deployment (stable embed URL)

The `/exec` URL is tied to a specific **deployment id**. If you create a *new*
deployment for every change, you get a *new* URL each time and your Site embed
breaks. Instead, **update the same deployment in place** so the URL stays stable.

List your deployments to find the id:

```bash
clasp deployments
```

Then update that deployment with a new version, keeping the URL:

```bash
clasp deploy --deploymentId <id> --description "v1.1"
```

In the editor the equivalent is **Manage deployments → edit (pencil) →
New version**.

---

## Embedding in Google Sites

1. Edit your Google Site → **Insert → Embed → By URL** → paste the **`/exec`**
   URL → **Insert**.
2. Size the embed block generously; the app manages its own scrolling.
3. **Publish** the Site to an audience **restricted to your Workspace domain**, so
   it matches the app's `Anyone within domain` access.
4. Add a visible **fallback link/button** elsewhere on the page —
   *"Open Booking System in a new tab"* — pointing at the same `/exec` URL with
   `target="_blank"`.

### The iframe-safety flags (already set)

The app already emits the two flags needed to live inside a Google Sites iframe,
so you do not have to configure anything for normal users:

- **`setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)`** — allows the
  page to be framed. Set in `doGet` in `src/Code.gs`.
- **`<base target="_top">`** in the Index template — lets links escape the iframe
  sandbox instead of trying to navigate inside it.

### Why the new-tab fallback

The embed works for normal signed-in users in the domain. But a minority of
browsers that block all third-party cookies/iframes may show a blank or sign-in
frame. Those users click the **new-tab link**, which always works because it
loads the app directly with no cross-origin frame.

---

## Ongoing redeploy workflow

After any code change:

1. `clasp push` to upload the new code.
2. Test on the **`/dev`** URL first (editor only).
3. Update the **pinned deployment** so the `/exec` URL stays the same:
   ```bash
   clasp deploy --deploymentId <id> --description "v1.x"
   ```
   (Or, in the editor: **Manage deployments → edit → New version**.)

Other ongoing maintenance:

- **Settings:** edit the `Config` tab — `timeZone`, `defaultBufferMin`,
  `bookingHorizonDays`, `reminderLeadHours`. See [[Configuration]].
- **Add / inactivate staff:** `addEmployee(...)`; to remove someone, set their
  `Users` row `active` to `FALSE` (history and past bookings are preserved).
- **Reminders:** an hourly trigger runs `sendDueReminders`. If it ever stops,
  re-run `installTriggers()`. See [[Notifications]].
- **Email quota:** Workspace allows ~1,500 recipients/day on the owner — far above
  this team's needs. The code skips and logs sends if the quota is ever hit.
- **Backups:** all data lives in one Google Sheet — use Google's version history,
  or File → Make a copy.

---

## Going-live checklist

- [ ] `clasp push` and `setup()` run; manager + employees added.
- [ ] Timezone confirmed in `Config` (and on the script + spreadsheet).
- [ ] Web app deployed (Execute as **Me**, access **Anyone within domain**);
      `/exec` URL noted and pinned.
- [ ] Reminder trigger present (`installTriggers()` / from setup).
- [ ] Embedded in the Google Site + fallback link added; Site published to the
      domain.
- [ ] Acceptance tests passed (at least the booking, conflict, notification and
      reporting rows). See [[Testing]].

---

## Related pages

- [[Getting Started]] — prerequisites, project creation, `setup()`, adding staff.
- [[Configuration]] — `Config` tab settings you may tune after going live.
- [[Security and Permissions]] — why "Execute as Me" keeps the Sheet private.
- [[Troubleshooting]] — blank iframe, "No access", `/dev` vs `/exec` confusion.
