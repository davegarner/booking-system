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

/** Web-app GET handler. @param {Object} e @return {HtmlOutput} */
function doGet(e) {
  let ctx = null;
  let state = 'OK';
  let notice = null;

  try {
    ctx = getCurrentUserContext();
  } catch (err) {
    // Reading the roster failed — almost always means setup() hasn't run yet.
    state = 'SETUP';
    notice = {
      title: 'Setup required',
      body: 'The booking system has not been initialised yet. An administrator needs to run setup() ' +
            'once in the Apps Script editor, then add staff with addEmployee(...).'
    };
  }

  let viewFile;
  if (state === 'SETUP') {
    viewFile = 'ui/Notice';
  } else if (!ctx.authorized) {
    state = 'UNAUTHORIZED';
    notice = {
      title: 'No access',
      body: 'Your Google account (' + (ctx.email || 'unknown') + ') is not on the FSW Booking roster. ' +
            'Please ask your manager to add you.'
    };
    viewFile = 'ui/Notice';
  } else {
    viewFile = (ctx.role === ROLES.MANAGER) ? 'ui/Manager' : 'ui/Employee';
  }

  const companyName = safeConfig_('companyName', 'FSW');
  const bootstrap = {
    state: state,
    email: ctx ? ctx.email : '',
    role: ctx ? ctx.role : null,
    userId: ctx ? ctx.userId : null,
    displayName: ctx ? ctx.displayName : '',
    tz: safeTz_(),
    companyName: companyName,
    notice: notice
  };

  const t = HtmlService.createTemplateFromFile('ui/Index');
  t.viewFile = viewFile;
  // Unescaped inject; neutralise any "</script>"-style break-outs in the JSON.
  t.bootstrapJson = JSON.stringify(bootstrap).replace(/</g, '\\u003c');

  return t.evaluate()
    .setTitle(companyName + ' Booking')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Include a partial/template file's content (used by Index via <?!= include(...) ?>). */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
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
