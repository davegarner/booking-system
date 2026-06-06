/**
 * TimeUtil.gs — timezone/DST-safe conversions. The most correctness-critical
 * module in the system. ALL local<->epoch conversion goes through here; nothing
 * else should construct dates from wall-clock parts.
 *
 * Canonical storage is UTC epoch-milliseconds. Recurring availability rules are
 * expressed as wall-clock ("HH:mm" on a calendar date) in the BUSINESS timezone
 * and resolved to epoch-ms here, so an "09:00 every Monday" block is correct
 * across daylight-saving transitions.
 *
 * Implementation note: Apps Script's Utilities.formatDate renders an instant in
 * any IANA zone; we use it to measure a zone's UTC offset at a given instant and
 * invert that to map wall-clock -> epoch.
 */

/**
 * UTC offset (ms) of zone `tz` at the instant `epochMs`. Positive = east of UTC.
 * offset = (wall-clock in tz) - (wall-clock in UTC), both read at the same instant.
 * @param {number} epochMs
 * @param {string} tz IANA zone, e.g. "Europe/London"
 * @return {number} offset in milliseconds
 */
function tzOffsetMsAt_(epochMs, tz) {
  const d = new Date(epochMs);
  const inTz = Utilities.formatDate(d, tz, "yyyy-MM-dd'T'HH:mm:ss");
  const inUtc = Utilities.formatDate(d, 'UTC', "yyyy-MM-dd'T'HH:mm:ss");
  return Date.parse(inTz + 'Z') - Date.parse(inUtc + 'Z');
}

/**
 * Convert a wall-clock date+time in `tz` to a UTC epoch-ms instant.
 * Handles DST by solving epoch = wallAsUtc - offset(epoch), iterating once to
 * settle across a transition.
 * @param {number} y full year, @param {number} mo 1-12, @param {number} d 1-31
 * @param {number} hh 0-23, @param {number} mm 0-59
 * @param {string} tz
 * @return {number} epoch-ms
 */
function localPartsToEpochMs(y, mo, d, hh, mm, tz) {
  const wallAsUtc = Date.UTC(y, mo - 1, d, hh, mm, 0, 0);
  let off = tzOffsetMsAt_(wallAsUtc, tz);
  let epoch = wallAsUtc - off;
  const off2 = tzOffsetMsAt_(epoch, tz);
  if (off2 !== off) epoch = wallAsUtc - off2; // re-settle near a DST boundary
  return epoch;
}

/**
 * Combine a calendar date (in tz) with an "HH:mm" wall-clock string.
 * @param {{y:number,mo:number,d:number}} dateParts
 * @param {string} hhmm e.g. "09:30"
 * @param {string} tz
 * @return {number} epoch-ms
 */
function dateAndTimeToEpochMs(dateParts, hhmm, tz) {
  const t = parseHhMm_(hhmm);
  return localPartsToEpochMs(dateParts.y, dateParts.mo, dateParts.d, t.h, t.m, tz);
}

/** Parse "HH:mm" -> {h, m}. */
function parseHhMm_(hhmm) {
  const parts = String(hhmm).split(':');
  return { h: Number(parts[0]), m: Number(parts[1] || 0) };
}

/**
 * Break an instant into local calendar parts in `tz`.
 * @return {{y:number, mo:number, d:number, hh:number, mm:number, dow:number}}
 *         dow: 0=Mon .. 6=Sun
 */
function epochToLocalParts(epochMs, tz) {
  const d = new Date(epochMs);
  const s = Utilities.formatDate(d, tz, "yyyy-MM-dd-HH-mm-u"); // u: 1=Mon..7=Sun
  const p = s.split('-').map(Number);
  return { y: p[0], mo: p[1], d: p[2], hh: p[3], mm: p[4], dow: p[5] - 1 };
}

/** Local day-of-week (0=Mon..6=Sun) for an instant. */
function dowLocal(epochMs, tz) {
  return epochToLocalParts(epochMs, tz).dow;
}

/** Epoch-ms of local 00:00 (start of day) for the day containing `epochMs`. */
function startOfLocalDayMs(epochMs, tz) {
  const p = epochToLocalParts(epochMs, tz);
  return localPartsToEpochMs(p.y, p.mo, p.d, 0, 0, tz);
}

/** Epoch-ms of local 00:00 on the NEXT day after the day containing `epochMs`. */
function startOfNextLocalDayMs(epochMs, tz) {
  return startOfLocalDayMs(startOfLocalDayMs(epochMs, tz) + 36 * MS_PER_HOUR, tz);
}

/** Days in a given local month. */
function daysInMonth_(y, mo) {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate(); // mo is 1-12; day 0 of next month
}

/**
 * Iterate each local calendar date whose day overlaps [winStart, winEnd).
 * Calls cb({y, mo, d, dayStartMs}) for every day from the day of winStart up to
 * (and including) the day of winEnd-1ms.
 */
function eachLocalDate(winStartMs, winEndMs, tz, cb) {
  if (winEndMs <= winStartMs) return;
  let cursor = startOfLocalDayMs(winStartMs, tz);
  const lastDayStart = startOfLocalDayMs(winEndMs - 1, tz);
  let guard = 0;
  while (cursor <= lastDayStart && guard < 1000) {
    const p = epochToLocalParts(cursor, tz);
    cb({ y: p.y, mo: p.mo, d: p.d, dayStartMs: cursor });
    cursor = startOfNextLocalDayMs(cursor, tz);
    guard++;
  }
}

/**
 * True if the local date containing `epochMs` is the nth occurrence of its
 * weekday in its month. nth=-1 means the last occurrence.
 */
function isNthWeekdayOfMonth_(epochMs, nth, tz) {
  const p = epochToLocalParts(epochMs, tz);
  const occurrence = Math.floor((p.d - 1) / 7) + 1;
  if (nth === -1) return p.d + 7 > daysInMonth_(p.y, p.mo); // no same-weekday next week => last
  return occurrence === nth;
}

/** Format an instant in the business tz (display only). */
function formatLocal(epochMs, pattern, tz) {
  return Utilities.formatDate(new Date(epochMs), tz || getTz(), pattern);
}

/** Friendly date+time for emails/UI, e.g. "Mon 9 Jun 2026, 14:00". */
function formatHuman(epochMs, tz) {
  return Utilities.formatDate(new Date(epochMs), tz || getTz(), 'EEE d MMM yyyy, HH:mm');
}
