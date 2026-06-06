/**
 * AvailabilityEngine.gs — derives bookable free time. The heart of the system.
 *
 * Availability is NEVER materialized into stored slots; it is computed on demand
 * by interval arithmetic:
 *
 *   free = (recurring rules ∪ one-off additions)
 *          − exceptions − time off − company closures − (bookings + buffers)
 *
 * Because bookings are subtracted live, cancelling or rescheduling a meeting
 * reopens its time automatically with no extra bookkeeping.
 *
 * `computeFreeRangesFromData` is PURE (no Sheet access) so it can be unit-tested.
 * `computeFreeRanges` is the thin wrapper that loads data from the Sheet.
 *
 * All intervals are objects {start, end} in epoch-ms, half-open [start, end).
 */

/* --------------------------- interval algebra ----------------------------- */

/** Intersect [s,e) with the window; null if empty. */
function clipInterval(s, e, winStart, winEnd) {
  const ns = Math.max(s, winStart);
  const ne = Math.min(e, winEnd);
  return ne > ns ? { start: ns, end: ne } : null;
}

/** Half-open overlap test. */
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/** Sort + union overlapping/touching intervals. */
function mergeIntervals(list) {
  if (!list.length) return [];
  const sorted = list.slice().sort(function (a, b) { return a.start - b.start; });
  const out = [{ start: sorted[0].start, end: sorted[0].end }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else out.push({ start: cur.start, end: cur.end });
  }
  return out;
}

/** base − union(blocks). Returns sorted, disjoint remainder. */
function subtractIntervals(base, blocks) {
  const merged = mergeIntervals(blocks);
  const out = [];
  base.forEach(function (b) {
    let segs = [{ start: b.start, end: b.end }];
    merged.forEach(function (blk) {
      const next = [];
      segs.forEach(function (s) {
        if (blk.end <= s.start || blk.start >= s.end) { next.push(s); return; } // no overlap
        if (blk.start > s.start) next.push({ start: s.start, end: blk.start });  // left remainder
        if (blk.end < s.end) next.push({ start: blk.end, end: s.end });          // right remainder
      });
      segs = next;
    });
    segs.forEach(function (s) { if (s.end > s.start) out.push(s); });
  });
  return out.sort(function (a, b) { return a.start - b.start; });
}

/* --------------------------- recurrence expansion ------------------------- */

/**
 * Expand one recurring rule into concrete intervals overlapping [winStart,winEnd).
 * Handles WEEKLY and MONTHLY (day-of-month and nth-weekday) modes, DST-correctly
 * (wall-clock times resolved per-day in the business tz).
 * @return {Array<{start:number,end:number}>}
 */
function expandRule(rule, winStart, winEnd, tz) {
  const out = [];
  const fromMs = (rule.effectiveFromMs === '' || rule.effectiveFromMs == null) ? -Infinity : Number(rule.effectiveFromMs);
  const toMs = (rule.effectiveToMs === '' || rule.effectiveToMs == null) ? Infinity : Number(rule.effectiveToMs);
  const fromDay = isFinite(fromMs) ? startOfLocalDayMs(fromMs, tz) : -Infinity;
  const toDay = isFinite(toMs) ? startOfLocalDayMs(toMs, tz) : Infinity;

  eachLocalDate(winStart, winEnd, tz, function (day) {
    if (day.dayStartMs < fromDay || day.dayStartMs > toDay) return; // outside effective window

    let matches = false;
    if (rule.freq === FREQ.WEEKLY) {
      matches = dowLocal(day.dayStartMs, tz) === Number(rule.dayOfWeek);
    } else if (rule.freq === FREQ.MONTHLY) {
      if (rule.monthlyMode === MONTHLY_MODE.DOM) {
        matches = day.d === Number(rule.dayOfMonth);
      } else if (rule.monthlyMode === MONTHLY_MODE.NTH_DOW) {
        matches = dowLocal(day.dayStartMs, tz) === Number(rule.nthDayOfWeek) &&
                  isNthWeekdayOfMonth_(day.dayStartMs, Number(rule.nth), tz);
      }
    }
    if (!matches) return;

    const s = dateAndTimeToEpochMs({ y: day.y, mo: day.mo, d: day.d }, rule.startTimeLocal, tz);
    const e = dateAndTimeToEpochMs({ y: day.y, mo: day.mo, d: day.d }, rule.endTimeLocal, tz);
    const clipped = clipInterval(s, e, winStart, winEnd);
    if (clipped) out.push(clipped);
  });
  return out;
}

/* --------------------------- free-range computation ----------------------- */

function truthy_(v) {
  return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1';
}

/**
 * PURE: compute an employee's free ranges from in-memory data.
 * @param {{rules,additions,exceptions,timeOff,closures,bookings}} data
 * @param {string} userId
 * @param {number} winStart @param {number} winEnd
 * @param {string} tz
 * @return {Array<{start:number,end:number}>}
 */
function computeFreeRangesFromData(data, userId, winStart, winEnd, tz) {
  const uid = String(userId);

  // 1–2: base availability = recurring rules ∪ one-off additions
  let base = [];
  (data.rules || []).forEach(function (rule) {
    if (String(rule.userId) !== uid || !truthy_(rule.active)) return;
    base = base.concat(expandRule(rule, winStart, winEnd, tz));
  });
  (data.additions || []).forEach(function (a) {
    if (String(a.userId) !== uid || !truthy_(a.active)) return;
    const c = clipInterval(Number(a.startMs), Number(a.endMs), winStart, winEnd);
    if (c) base.push(c);
  });
  base = mergeIntervals(base);

  // 3–6: blocks to subtract
  const blocks = [];
  function pushBlock(s, e) {
    const c = clipInterval(Number(s), Number(e), winStart, winEnd);
    if (c) blocks.push(c);
  }
  (data.exceptions || []).forEach(function (x) {
    if (String(x.userId) === uid && truthy_(x.active)) pushBlock(x.startMs, x.endMs);
  });
  (data.timeOff || []).forEach(function (t) {
    if (String(t.userId) === uid && truthy_(t.active)) pushBlock(t.startMs, t.endMs);
  });
  (data.closures || []).forEach(function (c) {
    if (truthy_(c.active)) pushBlock(c.startMs, c.endMs);
  });
  (data.bookings || []).forEach(function (b) {
    if (String(b.userId) !== uid) return;
    if (String(b.status) !== BOOKING_STATUS.CONFIRMED) return;
    const bs = Number(b.startMs) - Number(b.bufferBeforeMin || 0) * MS_PER_MIN;
    const be = Number(b.endMs) + Number(b.bufferAfterMin || 0) * MS_PER_MIN;
    pushBlock(bs, be);
  });

  // 7: free = base − blocks
  return subtractIntervals(base, mergeIntervals(blocks));
}

/**
 * Load the tabs needed to compute availability for one employee over a window.
 * Bookings are window-filtered with a 1-day margin so buffers near the edges are
 * still captured.
 * @private
 */
function loadAvailabilityData_(userId, winStart, winEnd, opts) {
  const uid = String(userId);
  const overlaps = function (s, e) { return Number(e) > winStart && Number(s) < winEnd; };
  const bOverlaps = function (s, e) { return Number(e) > (winStart - MS_PER_DAY) && Number(s) < (winEnd + MS_PER_DAY); };
  return {
    rules: readObjects(SHEETS.RULES, opts).filter(function (r) { return String(r.userId) === uid; }),
    additions: readObjects(SHEETS.ADDITIONS, opts).filter(function (r) { return String(r.userId) === uid && overlaps(r.startMs, r.endMs); }),
    exceptions: readObjects(SHEETS.EXCEPTIONS, opts).filter(function (r) { return String(r.userId) === uid && overlaps(r.startMs, r.endMs); }),
    timeOff: readObjects(SHEETS.TIME_OFF, opts).filter(function (r) { return String(r.userId) === uid && overlaps(r.startMs, r.endMs); }),
    closures: readObjects(SHEETS.CLOSURES, opts).filter(function (r) { return overlaps(r.startMs, r.endMs); }),
    bookings: readObjects(SHEETS.BOOKINGS, opts).filter(function (r) { return String(r.userId) === uid && bOverlaps(r.startMs, r.endMs); })
  };
}

/**
 * Compute an employee's free ranges over [winStart, winEnd) from the Sheet.
 * @param {string} userId @param {number} winStart @param {number} winEnd
 * @param {{noCache?:boolean}} [opts]
 * @return {Array<{start:number,end:number}>}
 */
function computeFreeRanges(userId, winStart, winEnd, opts) {
  const tz = getTz();
  const data = loadAvailabilityData_(userId, winStart, winEnd, opts);
  return computeFreeRangesFromData(data, userId, winStart, winEnd, tz);
}
