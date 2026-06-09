# FSW Booking System — Desktop Phase D0: Backend Token Authentication

**Document version:** 1.0
**Date:** 2026-06-08
**Phase status:** Code complete; awaiting owner deployment actions (see §9)
**Audience:** Project owner / reviewer (and future developers)

---

## 1. Purpose of this document

This is the design-and-build record for **Desktop Phase D0**, the first step in turning the FSW
Booking System into an installable **Windows desktop app** that signs in with Google.

D0 is **pure backend code**. It changes nothing about how the app looks or how your existing
Google Sites embed behaves. What it adds is a second, equally-secure way for the server to know
*who is calling it* — one that works for a desktop app, which (for reasons explained below) cannot
use the Google sign-in the browser version relies on.

It builds on the completed v1 (Phases 0–8). The desktop work is sequenced as:

- **D0 — Backend token authentication** *(this document)*
- D1 — Electron shell + system-browser Google sign-in
- D2 — Google Calendar sync (backend)
- D3 — Packaging (`.exe`), rollout, and acceptance testing

---

## 2. The problem D0 solves

The browser/Sites version identifies you with **no login screen**: because the web app is deployed
*"execute as the owner, accessible to anyone within the domain,"* Google hands the server your real
email via `Session.getActiveUser().getEmail()`. That only works because your browser is already
signed into Google and carries the session.

A desktop app has no such session. The obvious idea — *open the web app inside the desktop window
and let people sign into Google there* — **does not work**. Google deliberately **blocks its sign-in
and OAuth pages inside embedded desktop webviews** (the `disallowed_useragent` / "this browser or app
may not be secure" error). This applies to **every** desktop framework (Electron's Chromium and
Tauri's WebView2 alike), and the policy has been enforced since 2023 with no sign of changing.

Google's sanctioned alternative for desktop apps is to sign in using the **system browser** (Edge,
Chrome, etc.), which returns a small, signed proof of identity called an **ID token**. D0 teaches
the backend to accept that token. (Obtaining the token from the system browser is D1's job.)

---

## 3. What an ID token is (in one paragraph)

An **ID token** is a short-lived, cryptographically-signed statement from Google that says, in
effect, *"the holder of this token is `alice@yourdomain.com`, and this token was issued to your
specific application."* It is a JWT — three dot-separated parts encoding the claims (`email`,
`email_verified`, `aud` = which app it was issued for, `hd` = Workspace domain, `exp` = expiry) and
Google's signature. Because only Google can produce a valid signature, the backend can trust a token
it has verified just as much as it trusts a Google session.

---

## 4. What D0 delivers

- **Dual-mode identity** — the server's single identity choke point now resolves *either* a verified
  ID token (desktop) *or* the Google session (browser/Sites). Nothing else in the codebase had to
  change: every existing authorization guard keeps working unchanged.
- **A JSON API (`doPost`)** — a single, token-authenticated entry point the desktop app calls,
  dispatching to the **exact same** server functions the browser already uses via `google.script.run`.
- **Token verification** — a vetted, cached check of the ID token against Google, enforcing that the
  token was issued for *our* app and belongs to a verified (optionally domain-restricted) account.
- **An explicit allow-list** — only the 26 intended public actions are reachable through the API;
  internal helpers are not.
- **`getBootstrap`** — a desktop equivalent of the data the browser page is born with (who you are,
  which view to show), so the desktop app can render the right screen on launch.
- **Backward compatibility** — the existing Sites deployment is untouched and keeps using the session.

---

## 5. How it works

### 5.1 The identity choke point (`Auth.gs`)

All identity in the system flows through **one** function, `getActiveEmail_()`. Previously it only
read the Google session. It now prefers a request-scoped verified email when one is present:

```
function getActiveEmail_() {
  if (REQUEST_EMAIL_) return REQUEST_EMAIL_;   // token-authenticated (desktop app)
  const u = Session.getActiveUser();           // session-authenticated (browser / Sites)
  return (u && u.getEmail()) ? u.getEmail() : '';
}
```

`REQUEST_EMAIL_` is a module-level variable set only by the JSON API, only after the token has been
verified, and cleared again the instant the request finishes. Apps Script runs each web request in a
fresh, isolated execution, so this value is never shared between users or requests.

Because everything downstream (`getCurrentUserContext`, `requireAuthorized`, `requireManager`,
`requireSelfOrManager`) reads identity through this one function, **the desktop path inherits the
entire existing security model for free.** A token only tells the server *who you are*; whether you
are *allowed* to do something is still decided by your row in the `Users` roster.

### 5.2 Token verification (`Auth.gs` → `verifyGoogleIdToken_`)

When a desktop request arrives, the token is verified before anything else happens:

1. **Signature + expiry** are checked by Google itself — we call Google's `tokeninfo` endpoint, which
   validates the token's RSA signature and rejects expired or tampered tokens.
2. **Audience (`aud`)** — the token must have been issued for one of *our* registered OAuth client
   IDs. This is what stops someone presenting a valid Google token that was minted for a different,
   unrelated app.
3. **Email verified** — the account's email must be confirmed by Google.
4. **Domain (optional)** — if a Workspace domain is configured, the token's `hd` claim must match it.

The verified result is cached briefly (keyed by a hash of the token, expiring with the token) so a
flurry of clicks doesn't re-call Google for every action.

If desktop sign-in has not been configured yet (no client IDs registered), verification refuses
outright — a secure default that keeps the API closed until an administrator deliberately opens it.

### 5.3 The JSON API (`Code.gs` → `doPost`)

```
POST  <web-app-url>
Body  { "action": "createBooking", "idToken": "<google-id-token>", "args": [ ... ] }
->    { "ok": true,  "result": <whatever the function returns> }
->    { "ok": false, "error":  "<message>" }
```

`doPost` verifies the token, binds the identity, looks the action up in the allow-list, calls it with
the supplied arguments, and returns the result as JSON. The arguments are the same ones the browser
already passes through `google.script.run`, so the underlying functions did not change at all.

### 5.4 The allow-list (`Code.gs` → `API_ACTIONS_`)

A desktop client can only invoke names that appear in `API_ACTIONS_` — a hand-curated map of the 26
public actions (availability, time off, closures, booking, reporting, plus `getBootstrap` and
`getServerInfo`). Private helpers (named with a trailing underscore) are deliberately excluded, so
the API surface is exactly the intended one and nothing more. A unit test
(`test_apiActionsResolve_`) fails the build if any entry points at a function that doesn't exist.

---

## 6. Security analysis

| Concern | Browser (unchanged) | Desktop (new) |
|---|---|---|
| Who are you? | Google session (`Session.getActiveUser`) | Verified Google **ID token** (`tokeninfo`, `aud`, `email_verified`, optional `hd`) |
| What may you do? | `Users` roster + role guards | **Identical** roster + role guards |
| Can the client lie about identity/role? | No — server re-derives | No — server re-derives from the token, not from anything the client asserts |
| Can a token from another app be used? | n/a | No — `aud` must match our registered client ID |
| Can a stranger reach the API? | Domain-restricted | Reachable, but every call must carry a valid token **and** the email must be on the roster |

**Net effect:** the desktop path is held to the *same* authorization standard as the browser path.
The one deliberate change is the deployment access level (next section); it is compensated by the
token check, so effective security is unchanged.

---

## 7. Files changed in D0

| File | Change |
|---|---|
| `src/Auth.gs` | Added `REQUEST_EMAIL_` + `setRequestEmail_`; made `getActiveEmail_` dual-mode; added `verifyGoogleIdToken_`, `allowedClientIds_`, `allowedDomain_`. |
| `src/Code.gs` | Refactored `doGet` to share `computeView_`/`bootstrapObject_`; added `doPost`, `jsonOut_`, the `API_ACTIONS_` allow-list, and `getBootstrap`. |
| `src/Config.gs` | Added `oauthClientIds` and `allowedDomain` config keys; added a `setConfig_` upsert helper. |
| `src/Setup.gs` | Added `setDesktopAuth(clientIds, allowedDomain)` to register the desktop OAuth client. |
| `src/Tests.gs` | Added `test_apiActionsResolve_` (now 14 tests). |
| `src/appsscript.json` | Added the `script.external_request` scope (needed to call Google's token endpoint). |

No UI files changed. No existing function signatures changed.

---

## 8. The deployment model (important)

The browser and desktop paths need **different access settings**, and a single web-app deployment can
only have one. So the desktop app uses a **second deployment of the same script**:

| Deployment | Who has access | Identity source | Used by |
|---|---|---|---|
| **Sites** (existing) | Anyone within domain | Google session | The Google Sites embed / browser |
| **Desktop** (new) | Anyone, even anonymous | Verified ID token | The Windows app |

The desktop deployment must be *"Anyone, even anonymous"* because the desktop app cannot present a
Google session at the HTTP level — if the URL required a Google login, the app's plain POST would
just bounce off Google's login page. Opening the URL is safe precisely because **our own token check
is the real gate**: an anonymous POST without a valid, roster-matching token gets nothing.

This is the one security-posture decision to make consciously. It does not weaken the system: the
data is still reachable only by a verified, rostered Workspace user.

---

## 9. What the owner must do (when we reach D1)

These steps need your Google account and are **not** done yet. Full click-by-click instructions come
with D1; listed here so the path is visible:

1. **Create an OAuth client.** In the Google Cloud project behind the Apps Script, create an OAuth
   **Desktop** client ID. (Free; no verification needed for internal/Workspace use.)
2. **Register it.** In the Apps Script editor, run once:
   `setDesktopAuth("<the-client-id>.apps.googleusercontent.com", "yourdomain.com")`
   (the domain argument is optional; omit it for a roster-only check).
3. **Re-authorize the new scope.** The added `script.external_request` scope means the owner will be
   asked to re-grant permissions on the next run/redeploy — a one-time click.
4. **Create the desktop deployment.** Deploy → New deployment → Web app → **Who has access:
   Anyone, even anonymous** → copy the `/exec` URL for the desktop app to call.

The existing Sites deployment is left exactly as it is.

---

## 10. How to verify D0

- **Automated:** run `runAllTests()` in the Apps Script editor — it should report **14/14 passed**.
  The new test proves every API action resolves to a real function.
- **Manual (after the D1 steps above):** with a real ID token, a single round-trip confirms the API:

```
curl -L -X POST "<desktop-exec-url>" \
  -H "Content-Type: text/plain" \
  -d '{"action":"getServerInfo","idToken":"<google-id-token>","args":[]}'
# -> {"ok":true,"result":{"email":"you@yourdomain.com","role":"manager",...}}
```

An invalid or missing token returns `{"ok":false,"error":"..."}`; a non-rostered (but valid) account
authenticates but is refused by the roster guard — exactly as the browser behaves.

---

## 11. What D0 does **not** do

- It does not obtain tokens — that is the desktop app's job (**D1**).
- It does not build the Windows app or change any screen.
- It does not add Google Calendar sync (**D2**).
- It does not, by itself, make anything reachable: until `setDesktopAuth(...)` is run and the
  anonymous deployment is created, the JSON API stays closed.

**Next:** *Desktop Phase D1 — Electron shell + system-browser Google sign-in.*
