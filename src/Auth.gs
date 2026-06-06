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

/** @return {string} the signed-in user's email ('' if unavailable). */
function getActiveEmail_() {
  const u = Session.getActiveUser();
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
