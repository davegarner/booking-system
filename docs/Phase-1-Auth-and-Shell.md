# FSW Booking System — Phase 1: Authentication & App Shell

**Document version:** 1.0
**Date:** 2026-06-06
**Phase status:** Complete
**Audience:** Project owner / reviewer (and future developers)

---

## 1. Purpose of this document

This is the design-and-build record for **Phase 1**. It covers how the system identifies who is using it,
how it decides what each person is allowed to see and do, and the user-interface skeleton that every later
feature plugs into. After this phase the project is a real, deployable web app — you can open it, be
recognised, and land on the correct view — even though the feature screens are still placeholders.

It builds directly on the Phase 0 foundation (see *Phase 0 — Foundation*).

---

## 2. What Phase 1 delivers

- **Sign-in identity** — the app knows which Workspace user is visiting, with no separate login.
- **Roles** — each user is a *manager* or an *employee*, looked up from the `Users` tab.
- **Role-based routing** — the manager lands on the manager view; employees land on the employee view;
  unknown accounts and a not-yet-set-up system get clear, friendly notices instead of errors.
- **The app shell** — a consistent top bar, tabbed navigation, styling, and a client↔server connection check
  that proves the round-trip works and shows who you are.
- **Iframe-safety** — the two settings required for the app to display correctly when embedded in Google
  Sites (applied now so embedding "just works" in Phase 8).

---

## 3. How authentication and authorization work

### 3.1 Identity (who are you?)

The app is deployed to run **as the owner**, accessible to **anyone within the company's Workspace domain**.
A useful consequence of staying inside one domain is that Google still tells the app the visitor's real
email address (`Session.getActiveUser().getEmail()`), even though the code runs as the owner. That means:

- No extra login screen — staff are already signed into their Google account.
- No per-person authorization prompt — only the owner authorizes the app once.
- The data spreadsheet is never shared with ten people — all reads/writes go through the single owner
  identity.

### 3.2 Role (what are you allowed to do?)

The visitor's email is matched (case-insensitively) against the **`Users`** tab. The matching, *active* row
gives their `role` and `userId`. The result is a **user context**: `{ email, userId, role, displayName,
authorized }`.

### 3.3 The security principle

Because the app runs with the owner's full permissions, a curious or malicious employee could try to call
server functions directly from browser developer tools. Therefore **the server never trusts anything the
browser sends about identity**. Every server function re-derives who you are from the Google session and
re-checks your role. Three guards enforce this (`Auth.gs`):

| Guard | Meaning |
|---|---|
| `requireAuthorized()` | You must be on the roster (any role), else the call is rejected. |
| `requireManager()` | You must be a manager, else rejected. |
| `requireSelfOrManager(userId)` | You must be the manager *or* the specific employee whose data is being touched. |

These guards are used throughout the later phases so, for example, an employee can only edit *their own*
availability, while the manager can act for anyone.

---

## 4. Request routing

When the page is requested, the router (`doGet` in `Code.gs`) resolves the user context and chooses one of
these outcomes:

| Situation | What the visitor sees |
|---|---|
| System not initialised (no data spreadsheet yet) | **"Setup required"** notice — run `setup()` |
| Signed-in account not on the roster | **"No access"** notice — ask the manager to be added |
| Recognised **manager** | The **manager view** |
| Recognised **employee** | The **employee view** |

The chosen view is embedded into the shared page template, along with a small block of bootstrap data
(the user's name, role, timezone, company name, and any notice text). The bootstrap is injected safely so it
cannot break out of the page script.

---

## 5. The app shell

The interface is assembled from small HTML partials so each later phase only has to fill in its own panel.

| File | Role |
|---|---|
| `ui/Index.html` | The page skeleton: `<head>`, top bar, the injected view, and shared scripts |
| `ui/Styles.html` | All styling (a clean, Google-flavoured look; responsive down to mobile) |
| `ui/JsCommon.html` | Shared client JavaScript: a `google.script.run` promise wrapper, toast messages, tab switching, and the connection check |
| `ui/Employee.html` | Employee view: tabs for *My calendar*, *My availability*, *Time off* (placeholders) |
| `ui/Manager.html` | Manager view: tabs for *Schedule*, *Book a meeting*, *Closures*, *Team*, *Reports* (placeholders) |
| `ui/Notice.html` | The setup-required / no-access message card |

**Top bar** shows the company name, the signed-in person's name, and a colour-coded role badge
(green = manager, blue = employee, red = no access).

**Tabs** switch between panels within a view. Each placeholder panel names the phase that will deliver it,
so progress is visible at a glance.

**Connection check** — on load, the shell calls a tiny server endpoint (`getServerInfo`) and shows, in a
status line, a confirmation like *"✓ Connected — signed in as alex@… (employee). Server time: …"*. This is
the quickest way to confirm that identity resolution and the client↔server channel are both healthy.

---

## 6. Embedding safety (for Google Sites)

Two settings are applied now so the Phase 8 embedding is painless:

1. **`setXFrameOptionsMode(ALLOWALL)`** — without this, browsers refuse to display the app inside the Google
   Sites frame and it shows blank.
2. **`<base target="_top">`** in the page head — inside the Sites sandbox, links would otherwise be blocked;
   this lets any navigation open correctly.

A fallback "open in a new tab" link will also be provided on the Site in Phase 8 for the rare locked-down
browser that blocks third-party iframes entirely.

---

## 7. Files added in this phase

- `src/Auth.gs` — identity resolution and the three authorization guards.
- `src/Code.gs` — `doGet` routing, the `include()` partial helper, and the `getServerInfo` probe.
- `src/ui/Index.html`, `Styles.html`, `JsCommon.html`, `Employee.html`, `Manager.html`, `Notice.html`.

---

## 8. How to verify

Push the code (`clasp push`) and, if you haven't already, run `setup()` once. Then create a test deployment
(or use the editor's "Test deployments" → web app `/dev` URL) and check:

| Check | Expected result |
|---|---|
| Open the app as the **owner/manager** | Manager view with all five tabs; status line shows your email + "manager" + server time |
| Tabs switch | Clicking a tab swaps the panel below it |
| Open as an **employee** account (one you've `addEmployee`-d) | Employee view with three tabs; status line shows "employee" |
| Open as an account **not on the roster** | "No access" notice naming that email |
| Open **before** `setup()` has run | "Setup required" notice (no stack-trace error) |

> Tip: to test the employee experience without a second account, temporarily `addEmployee` your own test
> address, or change your own row's `role` to `employee` in the `Users` tab and reload.

---

## 9. What's next

| Phase | Deliverable |
|---|---|
| **2** | The **employee availability** screen — recurring patterns, one-off slots, exceptions, and the personal buffer — backed by a server API and writing into the tabs from Phase 0 |
| 3 | Time off and company-wide closures |
| 4 | Manager booking (the combined calendar + booking with validation) |

As with every phase, Phase 2 will ship its own `.md` and `.docx` document.
