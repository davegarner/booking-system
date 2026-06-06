/**
 * AvailabilityApi.gs — client-callable CRUD for an employee's availability.
 *
 * Covers recurring rules, one-off additions, exceptions, and the personal
 * buffer, plus a live preview of computed free time. Every entry point is
 * guarded by requireSelfOrManager so an employee can only touch their own
 * calendar (the manager may act for anyone). All wall-clock input is converted
 * to epoch-ms here, in the business timezone, so the client never deals with tz.
 *
 * Mutations are soft (active=false) and audited, preserving history.
 */

const _FREQS = [FREQ.WEEKLY, FREQ.MONTHLY];
const _MONTHLY_MODES = [MONTHLY_MODE.DOM, MONTHLY_MODE.NTH_DOW];
const _NTHS = [1, 2, 3, 4, 5, -1];

/* ------------------------------- read ------------------------------------ */

/**
 * Everything the employee availability screen needs in one call.
 * @param {string} userId
 * @return {{user:Object, rules:Array, additions:Array, exceptions:Array, tz:string}}
 */
function getEmployeeAvailability(userId) {
  requireSelfOrManager(userId);
  const uid = String(userId);
  const user = findById(SHEETS.USERS, uid);
  if (!user) throw new Error('Unknown user.');
  const now = Date.now();
  const futureActive = function (rows) {
    return rows.filter(function (r) { return truthy_(r.active) && Number(r.endMs) >= now; })
               .sort(function (a, b) { return Number(a.startMs) - Number(b.startMs); });
  };

  const rules = readObjects(SHEETS.RULES)
    .filter(function (r) { return String(r.userId) === uid && truthy_(r.active); })
    .map(cleanRule_);
  const additions = futureActive(readObjects(SHEETS.ADDITIONS).filter(function (r) { return String(r.userId) === uid; }))
    .map(function (a) { return spanRow_(a, 'additionId'); });
  const exceptions = futureActive(readObjects(SHEETS.EXCEPTIONS).filter(function (r) { return String(r.userId) === uid; }))
    .map(function (x) { return spanRow_(x, 'exceptionId'); });

  return {
    user: {
      userId: uid,
      displayName: String(user.displayName || ''),
      bufferMin: Number(user.bufferMin !== '' && user.bufferMin != null ? user.bufferMin : getConfig('defaultBufferMin')),
      recurrenceMode: String(user.recurrenceMode || FREQ.WEEKLY)
    },
    rules: rules,
    additions: additions,
    exceptions: exceptions,
    tz: getTz()
  };
}

/** Project a rule row to a clean client object. @private */
function cleanRule_(r) {
  return {
    ruleId: String(r.ruleId), freq: String(r.freq),
    dayOfWeek: r.dayOfWeek === '' ? null : Number(r.dayOfWeek),
    monthlyMode: r.monthlyMode || '',
    dayOfMonth: r.dayOfMonth === '' ? null : Number(r.dayOfMonth),
    nth: r.nth === '' ? null : Number(r.nth),
    nthDayOfWeek: r.nthDayOfWeek === '' ? null : Number(r.nthDayOfWeek),
    startTimeLocal: String(r.startTimeLocal), endTimeLocal: String(r.endTimeLocal)
  };
}

/** Project an addition/exception row to a clean client object with display text. @private */
function spanRow_(r, idField) {
  return {
    id: String(r[idField]),
    startMs: Number(r.startMs), endMs: Number(r.endMs),
    note: String(r.note || ''),
    dateText: formatLocal(Number(r.startMs), 'EEE d MMM yyyy'),
    startText: formatLocal(Number(r.startMs), 'HH:mm'),
    endText: formatLocal(Number(r.endMs), 'HH:mm')
  };
}

/* ------------------------------- recurring rules -------------------------- */

/**
 * Create (no ruleId) or update (with ruleId) a recurring availability rule.
 * @param {string} userId
 * @param {Object} rule
 * @return {string} ruleId
 */
function saveRule(userId, rule) {
  const ctx = requireSelfOrManager(userId);
  const uid = String(userId);
  validateRuleInput_(rule);
  const now = Date.now();

  if (rule.ruleId) {
    const existing = findById(SHEETS.RULES, rule.ruleId);
    if (!existing || String(existing.userId) !== uid) throw new Error('Rule not found.');
    const patch = ruleToRow_(uid, rule);
    updateById(SHEETS.RULES, rule.ruleId, patch);
    logAudit({ entityType: ENTITY.RULE, entityId: rule.ruleId, action: AUDIT_ACTION.UPDATE,
               actorUserId: ctx.userId, actorEmail: ctx.email, atMs: now, before: cleanRule_(existing), after: patch });
    return rule.ruleId;
  }
  const ruleId = Utilities.getUuid();
  const row = ruleToRow_(uid, rule);
  row.ruleId = ruleId;
  appendObject(SHEETS.RULES, row);
  logAudit({ entityType: ENTITY.RULE, entityId: ruleId, action: AUDIT_ACTION.CREATE,
             actorUserId: ctx.userId, actorEmail: ctx.email, atMs: now, after: row });
  return ruleId;
}

/** Soft-delete a recurring rule. */
function deleteRule(userId, ruleId) {
  const ctx = requireSelfOrManager(userId);
  const existing = findById(SHEETS.RULES, ruleId);
  if (!existing || String(existing.userId) !== String(userId)) throw new Error('Rule not found.');
  updateById(SHEETS.RULES, ruleId, { active: false });
  logAudit({ entityType: ENTITY.RULE, entityId: ruleId, action: AUDIT_ACTION.DELETE,
             actorUserId: ctx.userId, actorEmail: ctx.email, atMs: Date.now(), before: cleanRule_(existing) });
  return true;
}

/** Build a full rule row from validated input. @private */
function ruleToRow_(uid, rule) {
  const row = {
    userId: uid, freq: rule.freq,
    dayOfWeek: '', monthlyMode: '', dayOfMonth: '', nth: '', nthDayOfWeek: '',
    startTimeLocal: rule.startTimeLocal, endTimeLocal: rule.endTimeLocal,
    effectiveFromMs: '', effectiveToMs: '', active: true
  };
  if (rule.freq === FREQ.WEEKLY) {
    row.dayOfWeek = Number(rule.dayOfWeek);
  } else {
    row.monthlyMode = rule.monthlyMode;
    if (rule.monthlyMode === MONTHLY_MODE.DOM) row.dayOfMonth = Number(rule.dayOfMonth);
    else { row.nth = Number(rule.nth); row.nthDayOfWeek = Number(rule.nthDayOfWeek); }
  }
  return row;
}

function validateRuleInput_(r) {
  if (!r || _FREQS.indexOf(r.freq) === -1) throw new Error('Choose a valid frequency (weekly or monthly).');
  validateTimeRange_(r.startTimeLocal, r.endTimeLocal);
  if (r.freq === FREQ.WEEKLY) {
    const d = Number(r.dayOfWeek);
    if (!(d >= 0 && d <= 6)) throw new Error('Choose a day of the week.');
  } else {
    if (_MONTHLY_MODES.indexOf(r.monthlyMode) === -1) throw new Error('Choose a monthly pattern.');
    if (r.monthlyMode === MONTHLY_MODE.DOM) {
      const dom = Number(r.dayOfMonth);
      if (!(dom >= 1 && dom <= 31)) throw new Error('Day of month must be between 1 and 31.');
    } else {
      if (_NTHS.indexOf(Number(r.nth)) === -1) throw new Error('Choose which occurrence (1st–5th, or Last).');
      const dw = Number(r.nthDayOfWeek);
      if (!(dw >= 0 && dw <= 6)) throw new Error('Choose a weekday.');
    }
  }
}

function validateTimeRange_(start, end) {
  if (!/^\d{1,2}:\d{2}$/.test(String(start)) || !/^\d{1,2}:\d{2}$/.test(String(end))) {
    throw new Error('Enter valid start and end times.');
  }
  const s = parseHhMm_(start), e = parseHhMm_(end);
  const sm = s.h * 60 + s.m, em = e.h * 60 + e.m;
  if (!(sm >= 0 && sm < 1440 && em > 0 && em <= 1440)) throw new Error('Times must fall within a single day.');
  if (em <= sm) throw new Error('End time must be after start time.');
}

/* ------------------------------- one-off & exceptions --------------------- */

/** Add a one-off availability slot. payload: {date,startTime,endTime,note}. */
function addOneOff(userId, payload) {
  return addSpan_(SHEETS.ADDITIONS, 'additionId', ENTITY.ADDITION, userId, payload);
}
function deleteOneOff(userId, additionId) {
  return deleteSpan_(SHEETS.ADDITIONS, ENTITY.ADDITION, userId, additionId);
}
function addException(userId, payload) {
  return addSpan_(SHEETS.EXCEPTIONS, 'exceptionId', ENTITY.EXCEPTION, userId, payload);
}
function deleteException(userId, exceptionId) {
  return deleteSpan_(SHEETS.EXCEPTIONS, ENTITY.EXCEPTION, userId, exceptionId);
}

/** Shared add for additions/exceptions. @private */
function addSpan_(sheet, idField, entity, userId, payload) {
  const ctx = requireSelfOrManager(userId);
  const tz = getTz();
  validateTimeRange_(payload.startTime, payload.endTime);
  const startMs = parseLocalDateTime_(payload.date, payload.startTime, tz);
  const endMs = parseLocalDateTime_(payload.date, payload.endTime, tz);
  if (endMs <= startMs) throw new Error('End time must be after start time.');
  const id = Utilities.getUuid();
  const row = {}; row[idField] = id;
  row.userId = String(userId); row.startMs = startMs; row.endMs = endMs;
  row.note = String(payload.note || ''); row.active = true;
  appendObject(sheet, row);
  logAudit({ entityType: entity, entityId: id, action: AUDIT_ACTION.CREATE,
             actorUserId: ctx.userId, actorEmail: ctx.email, atMs: Date.now(), after: row });
  return id;
}

/** Shared soft-delete for additions/exceptions. @private */
function deleteSpan_(sheet, entity, userId, id) {
  const ctx = requireSelfOrManager(userId);
  const existing = findById(sheet, id);
  if (!existing || String(existing.userId) !== String(userId)) throw new Error('Entry not found.');
  updateById(sheet, id, { active: false });
  logAudit({ entityType: entity, entityId: id, action: AUDIT_ACTION.DELETE,
             actorUserId: ctx.userId, actorEmail: ctx.email, atMs: Date.now(),
             before: { startMs: Number(existing.startMs), endMs: Number(existing.endMs) } });
  return true;
}

/** Parse "yyyy-MM-dd" + "HH:mm" as business-tz wall-clock to epoch-ms. @private */
function parseLocalDateTime_(dateStr, timeStr, tz) {
  const dp = String(dateStr).split('-').map(Number);
  if (dp.length !== 3 || dp.some(function (n) { return isNaN(n); })) throw new Error('Choose a valid date.');
  const tp = parseHhMm_(timeStr);
  return localPartsToEpochMs(dp[0], dp[1], dp[2], tp.h, tp.m, tz);
}

/* ------------------------------- buffer & preview ------------------------- */

/** Set the employee's buffer (minutes between meetings). */
function setBuffer(userId, minutes) {
  const ctx = requireSelfOrManager(userId);
  const m = Number(minutes);
  if (!(m >= 0 && m <= 600)) throw new Error('Buffer must be between 0 and 600 minutes.');
  const before = findById(SHEETS.USERS, String(userId));
  if (!before) throw new Error('User not found.');
  updateById(SHEETS.USERS, String(userId), { bufferMin: m });
  logAudit({ entityType: ENTITY.USER, entityId: String(userId), action: AUDIT_ACTION.UPDATE,
             actorUserId: ctx.userId, actorEmail: ctx.email, atMs: Date.now(),
             before: { bufferMin: Number(before.bufferMin) }, after: { bufferMin: m } });
  return true;
}

/**
 * Preview computed free ranges between two local dates (inclusive of the end
 * day). Lets the employee see the effect of their settings.
 * @param {string} userId @param {string} fromDateStr "yyyy-MM-dd" @param {string} toDateStr "yyyy-MM-dd"
 * @return {Array<{start:number,end:number,dayText:string,startText:string,endText:string}>}
 */
function previewFreeRanges(userId, fromDateStr, toDateStr) {
  requireSelfOrManager(userId);
  const tz = getTz();
  const winStart = parseLocalDateTime_(fromDateStr, '00:00', tz);
  let winEnd = startOfNextLocalDayMs(parseLocalDateTime_(toDateStr, '00:00', tz), tz);
  if (!(winEnd > winStart)) throw new Error('The "to" date must be on or after the "from" date.');
  if (winEnd - winStart > 92 * MS_PER_DAY) throw new Error('Please choose a range of at most ~3 months.');
  return computeFreeRanges(String(userId), winStart, winEnd).map(function (r) {
    return {
      start: r.start, end: r.end,
      dayText: formatLocal(r.start, 'EEE d MMM'),
      startText: formatLocal(r.start, 'HH:mm'),
      endText: formatLocal(r.end, 'HH:mm')
    };
  });
}
