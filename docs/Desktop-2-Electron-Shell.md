# FSW Booking System — Desktop Phase D1: Electron Shell & Google Sign-in

**Document version:** 1.0
**Date:** 2026-06-08
**Phase status:** Code complete; runnable once the owner completes the Google-side setup (§7)
**Audience:** Project owner / reviewer (and future developers)

---

## 1. Purpose of this document

This is the design-and-build record for **Desktop Phase D1**. It turns the booking
system into an installable **Windows desktop application**: a window your team
opens from the Start menu, that signs them in with Google and shows the exact same
manager/employee screens as the web version.

D1 builds directly on **D0** (see *Desktop D0 — Backend Token Authentication*),
which taught the backend to trust a verified Google **ID token**. D1 is the client
that obtains that token and renders the UI around it.

---

## 2. The core challenge, and the shape of the solution

A desktop app can't reuse the browser's "no login screen" trick — that only works
because the browser already carries a Google session. And Google **blocks its
sign-in pages inside embedded desktop windows** (every framework, no exceptions).

Google's sanctioned path for desktop apps is to sign in using the **real system
browser**: the app opens the user's normal browser (Edge/Chrome), the user signs
in there as usual, and the result is handed back to the app on a temporary local
address (`http://127.0.0.1:<port>`), protected by **PKCE** (a one-time secret that
proves the same app that started the sign-in is the one finishing it). The app
receives an **ID token** identifying the user.

So the desktop app is genuinely thin:

- **It does the sign-in** (system browser) and **keeps the session** (a securely
  stored refresh token, so people sign in once).
- **It renders your existing UI**, unchanged.
- **It relays every action** to the same backend functions the web app already
  calls — just over the JSON API from D0 instead of the in-page Google bridge.

---

## 3. What D1 delivers

- A working **Electron** desktop app (`desktop/`) that runs on Windows (and macOS/
  Linux for development).
- **System-browser Google sign-in** with PKCE and a loopback redirect — no
  passwords or Google pages ever inside the app window.
- **Silent re-sign-in**: the refresh token is stored **encrypted at rest** (OS-
  backed; Windows DPAPI) so the app just opens, already signed in, next time.
- **Your real UI**, produced by a small **bundler** that assembles the desktop
  screens from the canonical `src/ui/*` source — so the desktop and web UIs never
  drift apart.
- **A single, secure bridge**: the UI's `gcall()` automatically routes through the
  desktop app; tokens never touch the web layer; there is no CORS to fight.
- A **Sign out** menu, external-link handling, single-instance behaviour, and an
  electron-builder configuration ready for packaging in D3.

One — and only one — line of your existing UI source changed (see §6.3).

---

## 4. How sign-in works (step by step)

1. On launch, the main process loads its config (OAuth client + the desktop
   `/exec` URL).
2. If a refresh token is stored, it silently exchanges it for a fresh ID token.
   Otherwise it starts an **interactive** sign-in:
   - generates a PKCE `code_verifier`/`code_challenge` and a random `state`;
   - starts a one-shot HTTP server on `127.0.0.1` (a random free port);
   - opens the **system browser** to Google's consent page;
   - the user signs in there; Google redirects back to the loopback address with a
     one-time code;
   - the app exchanges that code (plus the PKCE verifier) for an **ID token** and a
     **refresh token**, stores the refresh token encrypted, and closes the server.
3. The app calls `getBootstrap()` on the backend (with the ID token) to learn who
   the user is and which view to show.
4. It opens the window on the right screen.

The ID token is short-lived (~1 hour); the app refreshes it automatically before
it expires, so long sessions never get interrupted.

---

## 5. How a screen action works (step by step)

1. A button in the UI calls `gcall('createBooking', payload)` — exactly as in the
   web app.
2. `gcall` sees it's running in the desktop shell and forwards the call to the main
   process over Electron IPC.
3. The main process attaches a fresh ID token and POSTs
   `{ action, idToken, args }` to the backend's JSON API.
4. The backend verifies the token, re-derives identity and role, runs the **same**
   function the web app would have run, and returns `{ ok, result }`.
5. The main process resolves the UI's promise with `result` (or rejects it with the
   error) — indistinguishable, from the UI's point of view, from the web behaviour.

---

## 6. The pieces

### 6.1 The Electron app (`desktop/src`)

| File | Responsibility |
|---|---|
| `main.js` | App lifecycle. Loads config → signs in → fetches `getBootstrap` → opens the window. Hosts the IPC bridge, the menu (incl. **Sign out**), single-instance lock, and external-link handling. |
| `auth.js` | The Google native-app OAuth flow: PKCE, loopback server, system-browser launch, code exchange, refresh, and encrypted refresh-token storage via `safeStorage`. |
| `backend.js` | `callBackend()` — POSTs to the Apps Script JSON API and normalises the reply. Never throws. |
| `config.js` | Resolves settings from env vars → `userData/config.json` → app `config.json`. |
| `preload.js` | The only main↔page bridge. Exposes `window.FSW` (bootstrap) and `window.fswApi.call` (the backend bridge) before any page script runs. |

### 6.2 The UI bundler (`desktop/build/bundle-ui.mjs`)

Apps Script builds each page at request time by combining `Index.html` with the
stylesheet, the chosen view, and the relevant scripts (via `include()`). The
bundler does the same thing offline, producing one static document per view
(`renderer/manager.html`, `employee.html`, `notice.html`). It:

- inlines the stylesheet, the shared script (`JsCommon`), the view markup, and the
  view's script;
- removes the server-injected bootstrap line (the preload provides `window.FSW`);
- fails loudly if any Apps Script template tag would survive into a static file —
  a guard that catches UI-source changes the bundler hasn't been taught about.

Run it with `npm run bundle` whenever you change anything under `src/ui`. The
`renderer/` folder is generated and gitignored.

### 6.3 The one UI-source change

`src/ui/JsCommon.html` — the single `gcall()` wrapper now prefers the desktop
bridge when it exists, and otherwise behaves exactly as before:

```
if (window.fswApi && typeof window.fswApi.call === 'function') {
  return window.fswApi.call(method, args); // desktop shell
}
// ...otherwise the unchanged google.script.run path (browser / Sites)
```

Because this is the *only* place the UI talks to the server, nothing else in the
UI had to change. The browser/Sites version is byte-for-byte unaffected at runtime.

---

## 7. What the owner must do to run it (one-time)

These steps require your Google account and have **not** been done yet.

**A. Create the OAuth Desktop client**

1. Open the **Google Cloud Console** and select (or create) a project. Tip: a
   standard project you own works fine — the backend matches on the client ID, so
   the client doesn't have to live in the script's own GCP project.
2. **APIs & Services → OAuth consent screen** → User type **Internal** (Workspace
   only — no Google review needed) → app name e.g. *FSW Booking*, support email →
   Save. (Scopes stay at the defaults: `openid`, `email`, `profile` — all
   non-sensitive.)
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   Application type **Desktop app** → name *FSW Booking Desktop* → Create.
4. Copy the **Client ID** and **Client secret**. (For installed apps Google treats
   this secret as non-confidential — it's fine to ship it in the app.)

**B. Register the client with the backend**

5. In the **Apps Script editor**, run once:
   `setDesktopAuth("<client-id>.apps.googleusercontent.com", "yourdomain.com")`
   (omit the domain for a roster-only check). Approve the authorization prompt —
   this also grants the new external-request scope added in D0.

**C. Create the desktop deployment**

6. **Deploy → New deployment → Web app** → Description *Desktop API* → Execute as
   **Me** → Who has access **Anyone, even anonymous** → Deploy → copy the `/exec`
   URL. Your existing Sites deployment is left untouched.

**D. Configure and run the app**

7. Install **Node.js LTS** (18+). In `desktop/`, copy `config.example.json` to
   `config.json` and fill in `clientId`, `clientSecret`, `execUrl`, and optional
   `allowedDomain`.
8. Run `npm install`, then `npm start`. The system browser opens for sign-in once;
   after that the app remembers you.

---

## 8. Security notes

- **Tokens stay in the main process.** The renderer (web layer) only ever sees
  `window.fswApi.call`; it never holds the ID token or refresh token.
- **Refresh token encrypted at rest** via the OS keystore (`safeStorage` → DPAPI on
  Windows). Worst case if it can't encrypt: the user simply signs in again.
- **Context isolation on, Node integration off** in the renderer. The page can't
  reach Node or the file system.
- **Backend remains the real gate.** Even with the deployment open to anonymous
  HTTP, every call must carry a valid token whose `aud` matches our client ID, and
  the email must be on the roster (see D0 §6).
- **No sensitive OAuth scopes**, so the consent screen needs no Google verification
  for internal use.

---

## 9. Verification status

- **UI bundler:** verified against the real `src/ui/*` — all three views bundle with
  **zero** unresolved template tags, the desktop bridge present, and the correct
  markup/scripts (FullCalendar included in the manager view).
- **Runtime:** not yet exercised — it needs the Google-side setup in §7 and a local
  Node.js install (this project has no local JS runtime). Once configured,
  `npm start` is the end-to-end test; §10 lists what to expect.

---

## 10. Troubleshooting (once running)

| Symptom | Likely cause / fix |
|---|---|
| "not configured" dialog on launch | `config.json` missing or missing `clientId`/`execUrl`. |
| "server did not return JSON" | The desktop deployment isn't **Anyone, even anonymous**, or `execUrl` is wrong. |
| "token was issued for a different application" | The `clientId` in `config.json` doesn't match what `setDesktopAuth(...)` registered. |
| "not on the FSW Booking roster" | Expected for a valid Google account that isn't an employee — add them with `addEmployee(...)`. |
| Browser says "this app isn't verified" | For **Internal** consent screens this shouldn't appear; if it does, confirm the consent screen user type is Internal. |

---

## 11. What D1 does **not** do

- It does not add **Google Calendar sync** — that is **D2** (and lives in the
  backend, so it benefits the web users too).
- It does not produce the polished installer (icon, code-signing, rollout) — that
  is **D3**. `npm run dist` already produces a working installer for testing.

**Next:** *Desktop Phase D2 — Google Calendar sync.*
