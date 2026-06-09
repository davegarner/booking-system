/**
 * Code.gs — web-app entry point and routing.
 *
 * doGet identifies the visitor, picks the right view (manager / employee /
 * notice), and serves the Index template with that view embedded. It sets the
 * two flags required to live inside a Google Sites iframe:
 *   - setXFrameOptionsMode(ALLOWALL)  — allow framing
 *   - <base target="_top"> in Index   — allow links to escape the sandbox
 *
 * Client → server calls (google.script.run) land on the functions at the bottom;
 * each re-derives identity via Auth (never trusts the client).
 */

/**
 * Web-app GET handler (browser / Google Sites).
 * Identifies the visitor via their Google session, picks the right view, and
 * serves the Index template with the bootstrap payload injected. Sets the flags
 * needed to live inside a Sites iframe (ALLOWALL + <base target="_top">).
 * @param {Object} e @return {HtmlOutput}
 */
function doGet(e) {
  const boot = bootstrapObject_(computeView_());
  const viewFile = (boot.view === 'manager') ? 'ui/Manager'
                 : (boot.view === 'employee') ? 'ui/Employee'
                 : 'ui/Notice';

  const t = HtmlService.createTemplateFromFile('ui/Index');
  t.viewFile = viewFile;
  // Unescaped inject; neutralise any "</script>"-style break-outs in the JSON.
  t.bootstrapJson = JSON.stringify(boot).replace(/</g, '\\u003c');

  return t.evaluate()
    .setTitle(boot.companyName + ' Booking')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Resolve the current request's view from identity. Shared by doGet (browser)
 * and getBootstrap (desktop). Identity comes from Auth, which reads either the
 * Google session (browser) or a verified ID token (desktop) — see Auth.gs.
 * @return {{ctx:?Object, state:string, notice:?Object}}
 * @private
 */
function computeView_() {
  let ctx;
  try {
    ctx = getCurrentUserContext();
  } catch (err) {
    // Reading the roster failed — almost always means setup() hasn't run yet.
    return {
      ctx: null, state: 'SETUP',
      notice: {
        title: 'Setup required',
        body: 'The booking system has not been initialised yet. An administrator needs to run setup() ' +
              'once in the Apps Script editor, then add staff with addEmployee(...).'
      }
    };
  }
  if (!ctx.authorized) {
    return {
      ctx: ctx, state: 'UNAUTHORIZED',
      notice: {
        title: 'No access',
        body: 'Your Google account (' + (ctx.email || 'unknown') + ') is not on the FSW Booking roster. ' +
              'Please ask your manager to add you.'
      }
    };
  }
  return { ctx: ctx, state: 'OK', notice: null };
}

/**
 * Build the bootstrap payload shared by both transports. `view` names the panel
 * to render: 'manager' | 'employee' | 'notice'.
 * @param {{ctx:?Object, state:string, notice:?Object}} v
 * @return {Object}
 * @private
 */
function bootstrapObject_(v) {
  const ctx = v.ctx;
  const view = (v.state === 'OK') ? ((ctx.role === ROLES.MANAGER) ? 'manager' : 'employee') : 'notice';
  return {
    state: v.state,
    view: view,
    email: ctx ? ctx.email : '',
    role: ctx ? ctx.role : null,
    userId: ctx ? ctx.userId : null,
    displayName: ctx ? ctx.displayName : '',
    tz: safeTz_(),
    companyName: safeConfig_('companyName', 'FSW'),
    notice: v.notice
  };
}

/** Include a partial/template file's content (used by Index via <?!= include(...) ?>). */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ----------------------- token-authenticated JSON API --------------------- */

/**
 * Web-app POST handler — the JSON API the desktop app calls.
 *
 * Body (sent as text/plain to avoid a CORS preflight; parsed as JSON here):
 *   { "action": "<name>", "idToken": "<google-id-token>", "args": [ ... ] }
 * Response:
 *   { "ok": true,  "result": <value> }
 *   { "ok": false, "error":  "<message>" }
 *
 * The ID token is verified and bound as the request identity, so each dispatched
 * function re-derives the user and role through Auth exactly as the browser path
 * does. The client is never trusted for identity, role, or which user it acts on.
 * Requires a deployment with "Anyone, even anonymous" access (the desktop app
 * can't carry a Google session); our own token check is the real gate.
 * @param {Object} e @return {TextOutput}
 */
function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return jsonOut_({ ok: false, error: 'Malformed request body (expected JSON).' });
  }

  try {
    setRequestEmail_(verifyGoogleIdToken_(body.idToken));
    const fn = Object.prototype.hasOwnProperty.call(API_ACTIONS_, body.action) ? API_ACTIONS_[body.action] : null;
    if (typeof fn !== 'function') throw new Error('Unknown or unsupported action: ' + body.action);
    const args = Array.isArray(body.args) ? body.args : [];
    return jsonOut_({ ok: true, result: fn.apply(null, args) });
  } catch (err) {
    return jsonOut_({ ok: false, error: (err && err.message) ? err.message : String(err) });
  } finally {
    setRequestEmail_(null); // never let a bound identity leak past the request
  }
}

/** Serialize a value as a JSON HTTP response. @private */
function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Explicit allow-list of client-callable actions for doPost. Only these names
 * are reachable from a desktop client; private helpers (trailing _) are absent
 * by design. Mirrors the google.script.run surface the browser UI uses, plus
 * getBootstrap. Each target still enforces its own auth via Auth.
 * (Referenced functions are hoisted declarations, so cross-file order is fine.)
 */
const API_ACTIONS_ = {
  // identity / shell
  getBootstrap:            getBootstrap,
  getServerInfo:           getServerInfo,
  // availability (AvailabilityApi.gs)
  getEmployeeAvailability: getEmployeeAvailability,
  saveRule:                saveRule,
  deleteRule:              deleteRule,
  addOneOff:               addOneOff,
  deleteOneOff:            deleteOneOff,
  addException:            addException,
  deleteException:         deleteException,
  setBuffer:               setBuffer,
  previewFreeRanges:       previewFreeRanges,
  // time off & closures (TimeOffApi.gs)
  getTimeOff:              getTimeOff,
  addTimeOff:              addTimeOff,
  deleteTimeOff:           deleteTimeOff,
  getClosures:             getClosures,
  addClosure:              addClosure,
  deleteClosure:           deleteClosure,
  getRoster:               getRoster,
  getFlaggedBookings:      getFlaggedBookings,
  // booking (BookingApi.gs)
  validateBooking:         validateBooking,
  createBooking:           createBooking,
  getCalendarBookings:     getCalendarBookings,
  getMyUpcomingBookings:   getMyUpcomingBookings,
  rescheduleBooking:       rescheduleBooking,
  cancelBooking:           cancelBooking,
  // reporting (Reporting.gs)
  getReport:               getReport
};

/**
 * Identity + view payload for the desktop app's initial render. Mirrors the
 * bootstrap object doGet injects for the browser. Intentionally does NOT require
 * roster membership, so the desktop app can render the SETUP / "no access"
 * notice for non-rostered users.
 * @return {Object}
 */
function getBootstrap() {
  return bootstrapObject_(computeView_());
}

/* --------------------------- client-callable API -------------------------- */

/**
 * Lightweight identity + connectivity probe used by the shell to confirm the
 * client↔server round-trip and show who's signed in. Re-derives identity.
 * @return {Object}
 */
function getServerInfo() {
  const ctx = getCurrentUserContext();
  const now = Date.now();
  return {
    email: ctx.email,
    role: ctx.role,
    userId: ctx.userId,
    displayName: ctx.displayName,
    authorized: ctx.authorized,
    tz: getTz(),
    serverTimeMs: now,
    serverTimeText: formatHuman(now)
  };
}

/* ------------------------------- helpers ---------------------------------- */

function safeTz_() {
  try { return getTz(); } catch (e) { return DEFAULTS.timeZone; }
}

function safeConfig_(key, fallback) {
  try {
    const v = getConfig(key);
    return (v === undefined || v === null || v === '') ? fallback : v;
  } catch (e) { return fallback; }
}
