/**
 * Tests.gs — runnable unit tests for the correctness-critical core.
 *
 * Run `runAllTests()` from the Apps Script editor (or `clasp run runAllTests`).
 * These tests are PURE — they exercise TimeUtil and AvailabilityEngine directly
 * with in-memory data and a fixed timezone, so they need no data spreadsheet and
 * never touch production data.
 */

const TEST_TZ = 'Europe/London';

/** Run every test_* below; logs a summary and returns {pass, fail, failures}. */
function runAllTests() {
  const tests = [
    test_mergeIntervals_,
    test_subtractIntervals_,
    test_dstWinterVsSummerOffset_,
    test_localPartsRoundTrip_,
    test_expandRuleWeekly_,
    test_expandRuleMonthlyDom_,
    test_expandRuleMonthlyNthDow_,
    test_freeRangesBookingBuffer_,
    test_freeRangesTimeOffAndClosure_,
    test_freeRangesCancelledBookingReopens_,
    test_bookingFitsInFreeRange_,
    test_bookingRespectsBufferGap_,
    test_bookingExcludeSelfOnReschedule_
  ];
  let pass = 0; const failures = [];
  tests.forEach(function (t) {
    try { t(); pass++; Logger.log('PASS ' + t.name); }
    catch (e) { failures.push(t.name + ': ' + e.message); Logger.log('FAIL ' + t.name + ' — ' + e.message); }
  });
  const summary = pass + '/' + tests.length + ' passed' + (failures.length ? ('; FAILURES:\n' + failures.join('\n')) : '');
  Logger.log('—— ' + summary);
  return { pass: pass, fail: failures.length, failures: failures };
}

/* ------------------------------- helpers ---------------------------------- */

function assert_(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEq_(actual, expected, msg) {
  if (actual !== expected) throw new Error((msg || '') + ' expected=' + expected + ' actual=' + actual);
}
function ivs_(arr) { return JSON.stringify(arr); }
function ms_(y, mo, d, hh, mm) { return localPartsToEpochMs(y, mo, d, hh, mm, TEST_TZ); }

/* ------------------------------- interval algebra ------------------------- */

function test_mergeIntervals_() {
  const r = mergeIntervals([{ start: 30, end: 40 }, { start: 0, end: 10 }, { start: 10, end: 20 }]);
  assertEq_(ivs_(r), ivs_([{ start: 0, end: 20 }, { start: 30, end: 40 }]), 'merge w/ touch');
}

function test_subtractIntervals_() {
  const base = [{ start: 0, end: 100 }];
  const blocks = [{ start: 20, end: 30 }, { start: 50, end: 60 }];
  const r = subtractIntervals(base, blocks);
  assertEq_(ivs_(r), ivs_([{ start: 0, end: 20 }, { start: 30, end: 50 }, { start: 60, end: 100 }]), 'subtract two holes');
}

/* ------------------------------- timezone / DST --------------------------- */

function test_dstWinterVsSummerOffset_() {
  // Winter (GMT): 09:00 London == 09:00 UTC.
  assertEq_(ms_(2026, 1, 12, 9, 0), Date.UTC(2026, 0, 12, 9, 0, 0, 0), 'winter offset 0');
  // Summer (BST, +1): 09:00 London == 08:00 UTC.
  assertEq_(ms_(2026, 7, 13, 9, 0), Date.UTC(2026, 6, 13, 8, 0, 0, 0), 'summer offset +1');
}

function test_localPartsRoundTrip_() {
  const e = ms_(2026, 6, 9, 14, 30);
  const p = epochToLocalParts(e, TEST_TZ);
  assertEq_(p.y, 2026, 'year'); assertEq_(p.mo, 6, 'month'); assertEq_(p.d, 9, 'day');
  assertEq_(p.hh, 14, 'hour'); assertEq_(p.mm, 30, 'min');
}

/* ------------------------------- recurrence ------------------------------- */

function test_expandRuleWeekly_() {
  // Tuesday 2026-06-09. Rule: every Tuesday (dow=1) 09:00–12:00.
  const rule = { userId: 'u', freq: FREQ.WEEKLY, dayOfWeek: 1, startTimeLocal: '09:00', endTimeLocal: '12:00', active: true, effectiveFromMs: '', effectiveToMs: '' };
  const winStart = ms_(2026, 6, 8, 0, 0);   // Mon
  const winEnd = ms_(2026, 6, 15, 0, 0);    // next Mon
  const r = expandRule(rule, winStart, winEnd, TEST_TZ);
  assertEq_(r.length, 1, 'one Tuesday in window');
  assertEq_(r[0].start, ms_(2026, 6, 9, 9, 0), 'Tue start');
  assertEq_(r[0].end, ms_(2026, 6, 9, 12, 0), 'Tue end');
}

function test_expandRuleMonthlyDom_() {
  // 15th of each month, 10:00–11:00. Window spanning June.
  const rule = { userId: 'u', freq: FREQ.MONTHLY, monthlyMode: MONTHLY_MODE.DOM, dayOfMonth: 15, startTimeLocal: '10:00', endTimeLocal: '11:00', active: true, effectiveFromMs: '', effectiveToMs: '' };
  const r = expandRule(rule, ms_(2026, 6, 1, 0, 0), ms_(2026, 7, 1, 0, 0), TEST_TZ);
  assertEq_(r.length, 1, 'one 15th in June');
  assertEq_(r[0].start, ms_(2026, 6, 15, 10, 0), '15th start');
}

function test_expandRuleMonthlyNthDow_() {
  // 2nd Tuesday (nth=2, dow=1) of June 2026 is Tue 9 Jun.
  const rule = { userId: 'u', freq: FREQ.MONTHLY, monthlyMode: MONTHLY_MODE.NTH_DOW, nth: 2, nthDayOfWeek: 1, startTimeLocal: '13:00', endTimeLocal: '14:00', active: true, effectiveFromMs: '', effectiveToMs: '' };
  const r = expandRule(rule, ms_(2026, 6, 1, 0, 0), ms_(2026, 7, 1, 0, 0), TEST_TZ);
  assertEq_(r.length, 1, 'one 2nd-Tuesday');
  assertEq_(r[0].start, ms_(2026, 6, 9, 13, 0), '2nd Tue start');
}

/* ------------------------------- free ranges ------------------------------ */

function test_freeRangesBookingBuffer_() {
  // Base 09:00–17:00, one booking 12:00–13:00 with 15-min buffer each side.
  // Expect free: 09:00–11:45 and 13:15–17:00.
  const day = { s: ms_(2026, 6, 9, 9, 0), e: ms_(2026, 6, 9, 17, 0) };
  const data = {
    additions: [{ userId: 'u', startMs: day.s, endMs: day.e, active: true }],
    bookings: [{ userId: 'u', status: BOOKING_STATUS.CONFIRMED, startMs: ms_(2026, 6, 9, 12, 0), endMs: ms_(2026, 6, 9, 13, 0), bufferBeforeMin: 15, bufferAfterMin: 15 }]
  };
  const r = computeFreeRangesFromData(data, 'u', day.s, day.e, TEST_TZ);
  assertEq_(ivs_(r), ivs_([
    { start: ms_(2026, 6, 9, 9, 0), end: ms_(2026, 6, 9, 11, 45) },
    { start: ms_(2026, 6, 9, 13, 15), end: ms_(2026, 6, 9, 17, 0) }
  ]), 'booking+buffer carve-out');
}

function test_freeRangesTimeOffAndClosure_() {
  // Base 09:00–17:00; partial time off 09:00–10:00; company closure 16:00–17:00.
  // Expect free: 10:00–16:00.
  const day = { s: ms_(2026, 6, 9, 9, 0), e: ms_(2026, 6, 9, 17, 0) };
  const data = {
    additions: [{ userId: 'u', startMs: day.s, endMs: day.e, active: true }],
    timeOff: [{ userId: 'u', active: true, startMs: ms_(2026, 6, 9, 9, 0), endMs: ms_(2026, 6, 9, 10, 0) }],
    closures: [{ active: true, startMs: ms_(2026, 6, 9, 16, 0), endMs: ms_(2026, 6, 9, 17, 0) }]
  };
  const r = computeFreeRangesFromData(data, 'u', day.s, day.e, TEST_TZ);
  assertEq_(ivs_(r), ivs_([{ start: ms_(2026, 6, 9, 10, 0), end: ms_(2026, 6, 9, 16, 0) }]), 'timeoff+closure');
}

function test_freeRangesCancelledBookingReopens_() {
  // A cancelled booking must NOT subtract availability.
  const day = { s: ms_(2026, 6, 9, 9, 0), e: ms_(2026, 6, 9, 17, 0) };
  const data = {
    additions: [{ userId: 'u', startMs: day.s, endMs: day.e, active: true }],
    bookings: [{ userId: 'u', status: BOOKING_STATUS.CANCELLED, startMs: ms_(2026, 6, 9, 12, 0), endMs: ms_(2026, 6, 9, 13, 0), bufferBeforeMin: 15, bufferAfterMin: 15 }]
  };
  const r = computeFreeRangesFromData(data, 'u', day.s, day.e, TEST_TZ);
  assertEq_(ivs_(r), ivs_([{ start: day.s, end: day.e }]), 'cancelled booking reopens time');
}

/* ------------------------------- booking validation ----------------------- */

function baseDay_() {
  return { s: ms_(2026, 6, 9, 9, 0), e: ms_(2026, 6, 9, 17, 0) };
}

function test_bookingFitsInFreeRange_() {
  const day = baseDay_();
  const data = { additions: [{ userId: 'u', startMs: day.s, endMs: day.e, active: true }] };
  // 10:00–11:00 fits; 08:00–09:00 (before availability) does not.
  let free = computeFreeRangesFromData(data, 'u', ms_(2026, 6, 9, 10, 0), ms_(2026, 6, 9, 11, 0), TEST_TZ);
  assert_(meetingFitsFreeRanges_(free, ms_(2026, 6, 9, 10, 0), ms_(2026, 6, 9, 11, 0)), 'in-availability fits');
  free = computeFreeRangesFromData(data, 'u', ms_(2026, 6, 9, 8, 0), ms_(2026, 6, 9, 9, 0), TEST_TZ);
  assert_(!meetingFitsFreeRanges_(free, ms_(2026, 6, 9, 8, 0), ms_(2026, 6, 9, 9, 0)), 'before-availability rejected');
}

function test_bookingRespectsBufferGap_() {
  // Existing booking 12:00–13:00, buffer 15 => blocked 11:45–13:15.
  const day = baseDay_();
  const data = {
    additions: [{ userId: 'u', startMs: day.s, endMs: day.e, active: true }],
    bookings: [{ userId: 'u', bookingId: 'B', status: BOOKING_STATUS.CONFIRMED, startMs: ms_(2026, 6, 9, 12, 0), endMs: ms_(2026, 6, 9, 13, 0), bufferBeforeMin: 15, bufferAfterMin: 15 }]
  };
  // New 11:00–11:45 ends exactly at the buffer edge -> OK (half-open).
  let s = ms_(2026, 6, 9, 11, 0), e = ms_(2026, 6, 9, 11, 45);
  let free = computeFreeRangesFromData(data, 'u', s, e, TEST_TZ);
  assert_(meetingFitsFreeRanges_(free, s, e), 'meeting up to buffer edge fits');
  // New 11:00–11:50 crosses into the buffer -> rejected.
  s = ms_(2026, 6, 9, 11, 0); e = ms_(2026, 6, 9, 11, 50);
  free = computeFreeRangesFromData(data, 'u', s, e, TEST_TZ);
  assert_(!meetingFitsFreeRanges_(free, s, e), 'meeting into buffer rejected');
}

function test_bookingExcludeSelfOnReschedule_() {
  // Rescheduling booking B to its own slot must succeed once B is excluded.
  const day = baseDay_();
  const B = { userId: 'u', bookingId: 'B', status: BOOKING_STATUS.CONFIRMED, startMs: ms_(2026, 6, 9, 12, 0), endMs: ms_(2026, 6, 9, 13, 0), bufferBeforeMin: 15, bufferAfterMin: 15 };
  const data = { additions: [{ userId: 'u', startMs: day.s, endMs: day.e, active: true }], bookings: [B] };
  const s = ms_(2026, 6, 9, 12, 0), e = ms_(2026, 6, 9, 13, 0);
  let free = computeFreeRangesFromData(data, 'u', s, e, TEST_TZ);
  assert_(!meetingFitsFreeRanges_(free, s, e), 'own slot blocked while B present');
  const dataX = { additions: data.additions, bookings: data.bookings.filter(function (b) { return b.bookingId !== 'B'; }) };
  free = computeFreeRangesFromData(dataX, 'u', s, e, TEST_TZ);
  assert_(meetingFitsFreeRanges_(free, s, e), 'own slot free once B excluded');
}
