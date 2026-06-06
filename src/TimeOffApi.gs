/**
 * TimeOffApi.gs — time off, company-wide closures, and warn-and-flag.
 *
 * Time off and closures REMOVE availability. Unlike an exception (a pure
 * availability edit), time off can land over an existing booking. When that
 * happens we never delete the booking — we FLAG it (status stays CONFIRMED,
 * flag = TIMEOFF_CONFLICT) so the manager can decide to reschedule or cancel.
 *
 * Flag state is always RECOMPUTED from the current active time off + closures
 * (rather than tracked incrementally), so adding or removing either keeps flags
 * correct. All mutations run under the script lock and are audited.
 */

/* ------------------------------- shared ----------------------------------- */

/** Resolve a {scope, startMs, endMs} from a full-day or partial payload. @private */
function resolveSpan_(payload, tz) {
  if (payload.scope === TIMEOFF_SCOPE.FULL_DAY) {
    const s = parseLocalDateTime_(payload.startDate, '00:00', tz);
    const e = startOfNextLocalDayMs(parseLocalDateTime_(payload.endDate || payload.startDate, '00:00', tz), tz);
    if (!(e > s)) throw new Error('The end date must be on or after the start date.');
    return { scope: TIMEOFF_SCOPE.FULL_DAY, startMs: s, endMs: e };
  }
  validateTimeRange_(payload.startTime, payload.endTime);
  const s = parseLocalDateTime_(payload.date, payload.startTime, tz);
  const e = parseLocalDateTime_(payload.date, payload.endTime, tz);
  if (!(e > s)) throw new Error('End time must be after start time.');
  return { scope: TIMEOFF_SCOPE.PARTIAL, startMs: s, endMs: e };
}

/** Human description of a span for lists. @private */
function describeSpan_(scope, startMs, endMs, tz) {
  if (scope === TIMEOFF_SCOPE.FULL_DAY) {
    const firstDay = formatLocal(Number(startMs), 'EEE d MMM yyyy', tz);
    const lastDay = formatLocal(startOfLocalDayMs(Number(endMs) - 1, tz), 'EEE d MMM yyyy', tz);
    return (firstDay === lastDay) ? ('All day · ' + firstDay) : (firstDay + ' → ' + lastDay + ' (all day)');
  }
  return formatLocal(Number(startMs), 'EEE d MMM yyyy', tz) + ' · ' +
         formatLocal(Number(startMs), 'HH:mm', tz) + '–' + formatLocal(Number(endMs), 'HH:mm', tz);
}

/** All active user ids. @private */
function activeUserIds_() {
  return readObjects(SHEETS.USERS).filter(function (u) { return truthy_(u.active); }).map(function (u) { return String(u.userId); });
}

/** {userId: displayName} map. @private */
function getUserMap_() {
  const m = {};
  readObjects(SHEETS.USERS).forEach(function (u) { m[String(u.userId)] = String(u.displayName || u.email || ''); });
  return m;
}

/** Confirmed bookings for the given users overlapping [startMs,endMs) (un-buffered). @private */
function findOverlappingConfirmedBookings_(userIds, startMs, endMs) {
  const set = {}; userIds.forEach(function (u) { set[String(u)] = true; });
  return readObjects(SHEETS.BOOKINGS, { noCache: true }).filter(function (b) {
    return set[String(b.userId)] && String(b.status) === BOOKING_STATUS.CONFIRMED &&
           intervalsOverlap(Number(b.startMs), Number(b.endMs), Number(startMs), Number(endMs));
  });
}

/** Compact booking summary for manager warnings. @private */
function bookingSummary_(b, userMap) {
  return {
    bookingId: String(b.bookingId),
    employee: (userMap && userMap[String(b.userId)]) || '',
    clientName: String(b.clientName || ''),
    when: formatHuman(Number(b.startMs))
  };
}

/**
 * Recompute the conflict flag for every confirmed booking of the given users,
 * based on currently-active time off (per user) and closures (all users).
 * Flags only changed rows and audits FLAG/UNFLAG transitions. @private
 */
function recomputeFlagsForUsers_(userIds, ctx) {
  const set = {}; userIds.forEach(function (u) { set[String(u)] = true; });
  const now = Date.now();
  const timeoff = readObjects(SHEETS.TIME_OFF, { noCache: true }).filter(function (t) { return truthy_(t.active) && set[String(t.userId)]; });
  const closures = readObjects(SHEETS.CLOSURES, { noCache: true }).filter(function (c) { return truthy_(c.active); });
  const bookings = readObjects(SHEETS.BOOKINGS, { noCache: true }).filter(function (b) { return set[String(b.userId)] && String(b.status) === BOOKING_STATUS.CONFIRMED; });

  bookings.forEach(function (b) {
    const bs = Number(b.startMs), be = Number(b.endMs);
    let reason = '';
    for (let i = 0; i < closures.length; i++) {
      if (intervalsOverlap(bs, be, Number(closures[i].startMs), Number(closures[i].endMs))) {
        reason = closures[i].reason ? ('Company closure: ' + closures[i].reason) : 'Company closure'; break;
      }
    }
    if (!reason) {
      for (let j = 0; j < timeoff.length; j++) {
        if (String(timeoff[j].userId) === String(b.userId) &&
            intervalsOverlap(bs, be, Number(timeoff[j].startMs), Number(timeoff[j].endMs))) {
          reason = timeoff[j].reason ? ('Time off: ' + timeoff[j].reason) : 'Time off'; break;
        }
      }
    }
    const desired = reason ? BOOKING_FLAG.TIMEOFF_CONFLICT : BOOKING_FLAG.NONE;
    const current = String(b.flag || BOOKING_FLAG.NONE);
    if (desired !== current) {
      updateById(SHEETS.BOOKINGS, String(b.bookingId), { flag: desired, flagReason: reason });
      logAudit({
        entityType: ENTITY.BOOKING, entityId: String(b.bookingId),
        action: (desired === BOOKING_FLAG.TIMEOFF_CONFLICT) ? AUDIT_ACTION.FLAG : AUDIT_ACTION.UNFLAG,
        actorUserId: ctx ? ctx.userId : '', actorEmail: ctx ? ctx.email : '', atMs: now, reason: reason
      });
    }
  });
}

/* ------------------------------- individual time off ---------------------- */

/** Upcoming, active time off for a user. */
function getTimeOff(userId) {
  requireSelfOrManager(userId);
  const uid = String(userId), tz = getTz(), now = Date.now();
  return readObjects(SHEETS.TIME_OFF)
    .filter(function (t) { return String(t.userId) === uid && truthy_(t.active) && Number(t.endMs) >= now; })
    .sort(function (a, b) { return Number(a.startMs) - Number(b.startMs); })
    .map(function (t) {
      return { timeOffId: String(t.timeOffId), scope: String(t.scope), reason: String(t.reason || ''),
               text: describeSpan_(t.scope, t.startMs, t.endMs, tz) };
    });
}

/** Add time off for a user. Returns {timeOffId, affected:[...]} (flagged bookings). */
function addTimeOff(userId, payload) {
  const ctx = requireSelfOrManager(userId);
  const tz = getTz();
  const span = resolveSpan_(payload, tz);
  return withScriptLock(function () {
    const id = Utilities.getUuid();
    const row = {
      timeOffId: id, userId: String(userId), scope: span.scope,
      startMs: span.startMs, endMs: span.endMs, reason: String(payload.reason || ''),
      createdBy: ctx.userId, createdAtMs: Date.now(), active: true
    };
    appendObject(SHEETS.TIME_OFF, row);
    logAudit({ entityType: ENTITY.TIMEOFF, entityId: id, action: AUDIT_ACTION.CREATE,
               actorUserId: ctx.userId, actorEmail: ctx.email, atMs: Date.now(), after: row });
    const affected = findOverlappingConfirmedBookings_([String(userId)], span.startMs, span.endMs);
    recomputeFlagsForUsers_([String(userId)], ctx);
    const umap = getUserMap_();
    return { timeOffId: id, affected: affected.map(function (b) { return bookingSummary_(b, umap); }) };
  });
}

/** Soft-delete time off and recompute flags for that user. */
function deleteTimeOff(userId, timeOffId) {
  const ctx = requireSelfOrManager(userId);
  const existing = findById(SHEETS.TIME_OFF, timeOffId);
  if (!existing || String(existing.userId) !== String(userId)) throw new Error('Time off not found.');
  return withScriptLock(function () {
    updateById(SHEETS.TIME_OFF, timeOffId, { active: false });
    logAudit({ entityType: ENTITY.TIMEOFF, entityId: timeOffId, action: AUDIT_ACTION.DELETE,
               actorUserId: ctx.userId, actorEmail: ctx.email, atMs: Date.now(),
               before: { scope: existing.scope, startMs: Number(existing.startMs), endMs: Number(existing.endMs) } });
    recomputeFlagsForUsers_([String(userId)], ctx);
    return true;
  });
}

/* ------------------------------- company closures ------------------------- */

/** Upcoming, active company closures (manager only). */
function getClosures() {
  requireManager();
  const tz = getTz(), now = Date.now();
  return readObjects(SHEETS.CLOSURES)
    .filter(function (c) { return truthy_(c.active) && Number(c.endMs) >= now; })
    .sort(function (a, b) { return Number(a.startMs) - Number(b.startMs); })
    .map(function (c) {
      return { closureId: String(c.closureId), reason: String(c.reason || ''),
               text: describeSpan_(c.scope || TIMEOFF_SCOPE.FULL_DAY, c.startMs, c.endMs, tz) };
    });
}

/** Add a company-wide closure (manager only). Returns {closureId, affected:[...]}. */
function addClosure(payload) {
  const ctx = requireManager();
  const tz = getTz();
  const span = resolveSpan_(payload, tz);
  return withScriptLock(function () {
    const id = Utilities.getUuid();
    const row = {
      closureId: id, scope: span.scope, startMs: span.startMs, endMs: span.endMs,
      reason: String(payload.reason || ''), createdBy: ctx.userId, createdAtMs: Date.now(), active: true
    };
    appendObject(SHEETS.CLOSURES, row);
    logAudit({ entityType: ENTITY.CLOSURE, entityId: id, action: AUDIT_ACTION.CREATE,
               actorUserId: ctx.userId, actorEmail: ctx.email, atMs: Date.now(), after: row });
    const all = activeUserIds_();
    const affected = findOverlappingConfirmedBookings_(all, span.startMs, span.endMs);
    recomputeFlagsForUsers_(all, ctx);
    const umap = getUserMap_();
    return { closureId: id, affected: affected.map(function (b) { return bookingSummary_(b, umap); }) };
  });
}

/** Soft-delete a closure and recompute flags for everyone (manager only). */
function deleteClosure(closureId) {
  const ctx = requireManager();
  const existing = findById(SHEETS.CLOSURES, closureId);
  if (!existing) throw new Error('Closure not found.');
  return withScriptLock(function () {
    updateById(SHEETS.CLOSURES, closureId, { active: false });
    logAudit({ entityType: ENTITY.CLOSURE, entityId: closureId, action: AUDIT_ACTION.DELETE,
               actorUserId: ctx.userId, actorEmail: ctx.email, atMs: Date.now(),
               before: { startMs: Number(existing.startMs), endMs: Number(existing.endMs) } });
    recomputeFlagsForUsers_(activeUserIds_(), ctx);
    return true;
  });
}

/* ------------------------------- roster & conflicts ----------------------- */

/** Active roster (manager only) — used by manager screens to pick an employee. */
function getRoster() {
  requireManager();
  return readObjects(SHEETS.USERS)
    .filter(function (u) { return truthy_(u.active); })
    .map(function (u) {
      return { userId: String(u.userId), displayName: String(u.displayName || ''), email: String(u.email || ''),
               role: String(u.role || ''), bufferMin: Number(u.bufferMin || 0) };
    })
    .sort(function (a, b) { return a.displayName.localeCompare(b.displayName); });
}

/** Currently-flagged upcoming bookings (manager only) — the conflicts list. */
function getFlaggedBookings() {
  requireManager();
  const tz = getTz(), now = Date.now(), umap = getUserMap_();
  return readObjects(SHEETS.BOOKINGS)
    .filter(function (b) {
      return String(b.status) === BOOKING_STATUS.CONFIRMED &&
             String(b.flag) === BOOKING_FLAG.TIMEOFF_CONFLICT && Number(b.endMs) >= now;
    })
    .sort(function (a, b) { return Number(a.startMs) - Number(b.startMs); })
    .map(function (b) {
      return { bookingId: String(b.bookingId), employee: umap[String(b.userId)] || '',
               clientName: String(b.clientName || ''), when: formatHuman(Number(b.startMs), tz),
               flagReason: String(b.flagReason || '') };
    });
}
