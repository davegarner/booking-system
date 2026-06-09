/**
 * Auth.gs — identity and authorization. The security choke point.
 *
 * The web app is deployed "Execute as: Me (owner)" with "Anyone within domain"
 * access, so every visitor is a Workspace colleague and
 * Session.getActiveUser().getEmail() returns their real address (same-domain
 * exception). We map that email to a row in the Users tab to get their role.
 *
 * RULE: server functions must NEVER trust an email/role/userId sent from the
 * client (under execute-as-me, anyone could call any function from devtools).
 * Always re-derive identity here and re-check the role.
 */

/**
 * Request-scoped identity override.
 *
 * Browser / Google Sites requests (doGet + google.script.run) authenticate via
 * the Google session, so this stays null and getActiveEmail_ falls back to
 * Session.getActiveUser(). Token-authenticated requests (the desktop app, via
 * doPost) verify a Google ID token and bind the verified email here for the
 * duration of that single request. Apps Script runs each web request in a fresh
 * execution, so this module global is never shared between users or requests.
 * @private
 */
var REQUEST_EMAIL_ = null;

/** Bind (or clear, with null) the verified email for the current request. @private */
function setRequestEmail_(email) { REQUEST_EMAIL_ = email ? String(email) : null; }

/** @return {string} the signed-in user's email ('' if unavailable). */
function getActiveEmail_() {
  if (REQUEST_EMAIL_) return REQUEST_EMAIL_;   // token-authenticated (desktop app)
  const u = Session.getActiveUser();           // session-authenticated (browser / Sites)
  return (u && u.getEmail()) ? u.getEmail() : '';
}

/** Find an ACTIVE user row by email (case-insensitive), or null. @private */
function findUserByEmail_(email) {
  if (!email) return null;
  const target = String(email).toLowerCase();
  const users = readObjects(SHEETS.USERS);
  for (let i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase() === target && truthy_(users[i].active)) return users[i];
  }
  return null;
}

/**
 * Resolve the current request's user context from the session.
 * @return {{email:string, userId:?string, role:?string, displayName:string,
 *           bufferMin:?number, recurrenceMode:?string, authorized:boolean}}
 */
function getCurrentUserContext() {
  const email = getActiveEmail_();
  const user = findUserByEmail_(email);
  if (!user) {
    return { email: email, userId: null, role: null, displayName: '', bufferMin: null, recurrenceMode: null, authorized: false };
  }
  return {
    email: email,
    userId: String(user.userId),
    role: String(user.role),
    displayName: String(user.displayName || email),
    bufferMin: Number(user.bufferMin != null && user.bufferMin !== '' ? user.bufferMin : getConfig('defaultBufferMin')),
    recurrenceMode: String(user.recurrenceMode || FREQ.WEEKLY),
    authorized: true
  };
}

/** @return {boolean} */
function isManager_(ctx) { return !!ctx && ctx.role === ROLES.MANAGER; }

/** Require any rostered user; returns the context or throws. */
function requireAuthorized() {
  const ctx = getCurrentUserContext();
  if (!ctx.authorized) {
    throw new Error('Not authorized: your account (' + (ctx.email || 'unknown') + ') is not on the FSW Booking roster.');
  }
  return ctx;
}

/** Require manager role; returns the context or throws. */
function requireManager() {
  const ctx = requireAuthorized();
  if (!isManager_(ctx)) throw new Error('Not authorized: manager access required.');
  return ctx;
}

/**
 * Require that the current user is either the manager OR the target employee.
 * Used to guard per-employee reads/writes so staff can only touch their own data.
 * @param {string} targetUserId
 * @return {Object} the current user context
 */
function requireSelfOrManager(targetUserId) {
  const ctx = requireAuthorized();
  if (ctx.role === ROLES.MANAGER) return ctx;
  if (String(ctx.userId) === String(targetUserId)) return ctx;
  throw new Error('Not authorized: you can only act on your own calendar.');
}

/* --------------------- token verification (desktop app) -------------------- */

/**
 * Verify a Google ID token (JWT) and return its verified email, or throw.
 *
 * Desktop clients can't carry a Google web session, so instead of trusting the
 * session they present an ID token obtained via Google's native-app OAuth flow
 * (system browser + loopback + PKCE — see the Desktop docs). We validate it
 * against Google's tokeninfo endpoint (which checks the RSA signature and
 * expiry server-side), then additionally enforce:
 *   - aud            — the token was minted for one of OUR registered client IDs
 *   - email_verified — the address is real
 *   - hd (optional)  — restrict to a single Workspace domain
 * Roster membership is still enforced downstream by requireAuthorized(), so a
 * valid token for a non-rostered Google account is authenticated but not
 * authorized — exactly like the browser path.
 *
 * The verified result is cached briefly (keyed by a hash of the token) so a
 * burst of UI calls doesn't re-hit tokeninfo on every click.
 * @param {string} idToken
 * @return {string} verified email
 * @private
 */
function verifyGoogleIdToken_(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Sign-in required: no identity token was supplied.');
  }

  const allowed = allowedClientIds_();
  if (!allowed.length) {
    throw new Error('Desktop sign-in is not configured: no OAuth client IDs are registered. ' +
                    'A manager must run setDesktopAuth("<client-id>") once.');
  }

  const cache = CacheService.getScriptCache();
  const key = 'idtok:' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken));
  const hit = cache.get(key);
  if (hit) return hit;

  const resp = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error('Sign-in token was rejected by Google (invalid or expired). Please sign in again.');
  }

  let claims;
  try { claims = JSON.parse(resp.getContentText()); }
  catch (e) { throw new Error('Could not read the sign-in token response from Google.'); }

  if (allowed.indexOf(String(claims.aud)) === -1) {
    throw new Error('Sign-in token was issued for a different application.');
  }
  if (claims.exp && (Number(claims.exp) * 1000) <= Date.now()) {
    throw new Error('Sign-in token has expired. Please sign in again.');
  }
  if (!claims.email || String(claims.email_verified) !== 'true') {
    throw new Error('Your Google account email could not be verified.');
  }
  const domain = allowedDomain_();
  if (domain && String(claims.hd || '').toLowerCase() !== domain.toLowerCase()) {
    throw new Error('Sign-in is restricted to ' + domain + ' accounts.');
  }

  const email = String(claims.email);
  // Cache until ~30s before the token expires, capped at 5 minutes.
  let ttl = 300;
  if (claims.exp) {
    ttl = Math.min(300, Math.max(0, Number(claims.exp) - Math.floor(Date.now() / 1000) - 30));
  }
  if (ttl > 0) cache.put(key, email, ttl);
  return email;
}

/** Registered desktop/web OAuth client IDs that ID tokens must match (aud). @private */
function allowedClientIds_() {
  return String(safeConfig_('oauthClientIds', ''))
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
}

/** Optional Workspace hosted-domain restriction for desktop sign-in ('' = none). @private */
function allowedDomain_() {
  return String(safeConfig_('allowedDomain', '')).trim();
}
