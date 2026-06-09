# FSW Booking — Desktop app (Electron)

A thin, secure Windows desktop wrapper around the FSW Booking Apps Script backend.
It signs in with Google **in your system browser** (the only method Google allows
for desktop apps), then renders your existing UI and talks to the backend's JSON
API with a verified ID token.

> Full design & rationale: [../docs/Desktop-2-Electron-Shell.md](../docs/Desktop-2-Electron-Shell.md)
> Backend it depends on: [../docs/Desktop-1-Backend-Token-Auth.md](../docs/Desktop-1-Backend-Token-Auth.md)

## One-time setup

1. **Backend (Apps Script):** create an OAuth **Desktop** client in Google Cloud,
   then in the Apps Script editor run `setDesktopAuth("<client-id>", "yourdomain.com")`,
   and create a **second** web-app deployment with access **"Anyone, even anonymous"**.
   (Step-by-step in the design doc, §7.)
2. **Config:** copy `config.example.json` → `config.json` and fill in:
   - `clientId`, `clientSecret` — from the OAuth Desktop client
   - `execUrl` — the `/exec` URL of the *anonymous* deployment
   - `allowedDomain` — optional, e.g. `"yourdomain.com"`
3. **Node.js:** install Node.js LTS (18+). Then in this folder:

   ```
   npm install
   npm start
   ```

## Scripts

| Command | What it does |
|---|---|
| `npm run bundle` | Rebuild `renderer/*.html` from `../src/ui/*` (run after editing the UI). |
| `npm start` | Bundle + launch the app. |
| `npm run dist` | Bundle + build a Windows installer into `dist/` (see Phase D3). |

## How it fits together

```
 ┌─────────────┐  system browser (PKCE)   ┌────────────┐
 │ main.js     │ ───────────────────────► │  Google    │
 │ (Node)      │ ◄─── id_token + refresh ─│  OAuth     │
 │             │                          └────────────┘
 │  callBackend│  POST {action,idToken,args}   ┌─────────────────────┐
 │             │ ────────────────────────────► │ Apps Script doPost  │
 │             │ ◄─── {ok,result|error} ────── │ (anonymous deploy)  │
 └────┬────────┘                               └─────────────────────┘
      │ IPC (window.fswApi.call)
 ┌────▼────────┐
 │ renderer    │  your existing UI; gcall() routes to window.fswApi
 │ (Chromium)  │  window.FSW set by preload before any page script
 └─────────────┘
```

Tokens live only in the main process. `renderer/`, `dist/`, and `config.json`
are gitignored.
