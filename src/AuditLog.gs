/**
 * AuditLog.gs — append-only history of every mutating action.
 *
 * Each entry captures who did what, when, and a JSON snapshot of before/after
 * state, so the manager can reconstruct any booking's life without re-joining
 * other tabs. Rows are never edited or deleted.
 */

/**
 * Append an audit entry.
 * @param {{
 *   entityType: string, entityId: string, action: string,
 *   actorUserId?: string, actorEmail?: string, atMs: number,
 *   reason?: string, before?: Object, after?: Object
 * }} e
 * @return {string} the new auditId
 */
function logAudit(e) {
  const auditId = Utilities.getUuid();
  appendObject(SHEETS.AUDIT, {
    auditId: auditId,
    entityType: e.entityType,
    entityId: e.entityId,
    action: e.action,
    actorUserId: e.actorUserId || '',
    actorEmail: e.actorEmail || '',
    atMs: e.atMs,
    reason: e.reason || '',
    beforeJson: e.before ? JSON.stringify(e.before) : '',
    afterJson: e.after ? JSON.stringify(e.after) : ''
  });
  return auditId;
}

/**
 * Read audit entries for one entity, newest first.
 * @param {string} entityId
 * @return {Array<Object>}
 */
function getAuditFor(entityId) {
  return readObjects(SHEETS.AUDIT)
    .filter(function (r) { return String(r.entityId) === String(entityId); })
    .sort(function (a, b) { return Number(b.atMs) - Number(a.atMs); });
}
