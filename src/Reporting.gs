/**
 * Reporting.gs — manager dashboard metrics.
 *
 * For a date range, per active employee:
 *   - Offered hours = the availability they made bookable (recurring + one-off,
 *     minus exceptions, time off and closures) — computed with the SAME engine
 *     as everywhere else, with bookings excluded so it reflects capacity.
 *   - Booked hours  = confirmed meeting time within the range.
 *   - Utilisation   = booked ÷ offered.
 * Plus a company-wide breakdown by meeting type. Read-only; manager only.
 */

function sumRanges_(ranges) { return ranges.reduce(function (a, r) { return a + (r.end - r.start); }, 0); }
function clippedDur_(s, e, ws, we) { return Math.max(0, Math.min(e, we) - Math.max(s, ws)); }
function round1_(x) { return Math.round(x * 10) / 10; }

/**
 * @param {string} fromDateStr "yyyy-MM-dd" @param {string} toDateStr "yyyy-MM-dd" (inclusive)
 * @return {{from,to,rows:Array,totals:Object,byType:Array}}
 */
function getReport(fromDateStr, toDateStr) {
  requireManager();
  const tz = getTz();
  const ws = parseLocalDateTime_(fromDateStr, '00:00', tz);
  const we = startOfNextLocalDayMs(parseLocalDateTime_(toDateStr, '00:00', tz), tz);
  if (!(we > ws)) throw new Error('The "to" date must be on or after the "from" date.');
  if (we - ws > 400 * MS_PER_DAY) throw new Error('Please choose a range under about a year.');

  // Read each tab once; filter in memory.
  const users = readObjects(SHEETS.USERS).filter(function (u) { return truthy_(u.active); });
  const rules = readObjects(SHEETS.RULES);
  const additions = readObjects(SHEETS.ADDITIONS);
  const exceptions = readObjects(SHEETS.EXCEPTIONS);
  const timeOff = readObjects(SHEETS.TIME_OFF);
  const closures = readObjects(SHEETS.CLOSURES);
  const bookings = readObjects(SHEETS.BOOKINGS).filter(function (b) {
    return String(b.status) === BOOKING_STATUS.CONFIRMED && Number(b.endMs) > ws && Number(b.startMs) < we;
  });

  const byTypeGlobal = {};
  let totCap = 0, totBooked = 0, totMeetings = 0;

  const rows = users.map(function (u) {
    const uid = String(u.userId);
    const data = {
      rules: rules.filter(function (r) { return String(r.userId) === uid; }),
      additions: additions.filter(function (r) { return String(r.userId) === uid; }),
      exceptions: exceptions.filter(function (r) { return String(r.userId) === uid; }),
      timeOff: timeOff.filter(function (r) { return String(r.userId) === uid; }),
      closures: closures,
      bookings: [] // capacity = offered availability, before meetings are subtracted
    };
    const capMs = sumRanges_(computeFreeRangesFromData(data, uid, ws, we, tz));
    const mine = bookings.filter(function (b) { return String(b.userId) === uid; });
    let bookedMs = 0;
    mine.forEach(function (b) {
      const dur = clippedDur_(Number(b.startMs), Number(b.endMs), ws, we);
      bookedMs += dur;
      const t = String(b.meetingType || '(unspecified)');
      if (!byTypeGlobal[t]) byTypeGlobal[t] = { ms: 0, meetings: 0 };
      byTypeGlobal[t].ms += dur; byTypeGlobal[t].meetings += 1;
    });
    totCap += capMs; totBooked += bookedMs; totMeetings += mine.length;
    return {
      name: String(u.displayName || u.email || ''), role: String(u.role || ''),
      bookedHours: round1_(bookedMs / MS_PER_HOUR), capacityHours: round1_(capMs / MS_PER_HOUR),
      meetings: mine.length, utilisation: capMs > 0 ? Math.round(bookedMs / capMs * 100) : null
    };
  }).sort(function (a, b) { return b.bookedHours - a.bookedHours; });

  const byType = Object.keys(byTypeGlobal).map(function (t) {
    return { type: t, hours: round1_(byTypeGlobal[t].ms / MS_PER_HOUR), meetings: byTypeGlobal[t].meetings };
  }).sort(function (a, b) { return b.hours - a.hours; });

  return {
    from: fromDateStr, to: toDateStr, rows: rows,
    totals: {
      bookedHours: round1_(totBooked / MS_PER_HOUR), capacityHours: round1_(totCap / MS_PER_HOUR),
      meetings: totMeetings, utilisation: totCap > 0 ? Math.round(totBooked / totCap * 100) : null
    },
    byType: byType
  };
}
