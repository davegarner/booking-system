/**
 * BookingApi.gs — manager booking: validation, creation, and calendar reads.
 *
 * Booking rule (single source of truth): a proposed meeting is valid iff the
 * un-buffered meeting interval [start,end) fits entirely inside ONE of the
 * employee's free ranges, where free ranges already have every OTHER confirmed
 * booking subtracted *together with its buffer*. That single check enforces, in
 * one shot: inside marked availability, no overlap with another meeting, and the
 * required buffer gap between meetings (one buffer between neighbours, not two).
 *
 * Creation runs inside the script lock and re-validates against freshly-committed
 * data, so two managers can never double-book the same slot.
 */

/** Does [start,end) sit fully within a single free range? @private */
function meetingFitsFreeRanges_(free, startMs, endMs) {
  return free.some(function (r) { return r.start <= startMs && endMs <= r.end; });
}

function isValidEmail_(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || '')); }

/**
 * Validate a proposed meeting against availability, buffers, time off and other
 * meetings. Pure-ish: reads data from the Sheet but no writes.
 * @param {string} userId @param {number} startMs @param {number} lengthMin
 * @param {?string} excludeBookingId  ignore this booking's footprint (reschedule)
 * @param {{nowMs?:number}} [opts]
 * @return {{ok:boolean, reason?:string, endMs?:number, bufferMin?:number}}
 */
function validateBooking(userId, startMs, lengthMin, excludeBookingId, opts) {
  opts = opts || {};
  startMs = Number(startMs);
  const len = Number(lengthMin);
  if (!(len > 0)) return { ok: false, reason: 'Enter a meeting length greater than zero.' };
  const endMs = startMs + len * MS_PER_MIN;
  const now = opts.nowMs || Date.now();
  if (startMs < now - MS_PER_MIN) return { ok: false, reason: 'That start time is in the past.' };
  const horizonDays = Number(getConfig('bookingHorizonDays'));
  if (startMs > now + horizonDays * MS_PER_DAY) {
    return { ok: false, reason: 'That date is beyond the booking window (' + horizonDays + ' days).' };
  }
  const user = findById(SHEETS.USERS, String(userId));
  if (!user || !truthy_(user.active)) return { ok: false, reason: 'Unknown or inactive employee.' };

  const tz = getTz();
  const data = loadAvailabilityData_(String(userId), startMs, endMs, { noCache: true });
  if (excludeBookingId) {
    data.bookings = data.bookings.filter(function (b) { return String(b.bookingId) !== String(excludeBookingId); });
  }
  const free = computeFreeRangesFromData(data, String(userId), startMs, endMs, tz);
  if (!meetingFitsFreeRanges_(free, startMs, endMs)) {
    return { ok: false, reason: 'That time isn\'t fully within the employee\'s free time — it may clash with availability, another meeting, the buffer, time off, or a closure.' };
  }
  const bufferMin = Number(user.bufferMin != null && user.bufferMin !== '' ? user.bufferMin : getConfig('defaultBufferMin'));
  return { ok: true, endMs: endMs, bufferMin: bufferMin };
}

/** Validate the booking form payload (manager-entered). @private */
function validateBookingPayload_(p) {
  if (!p || !p.userId) throw new Error('Choose an employee.');
  if (!p.date) throw new Error('Choose a date.');
  if (!/^\d{1,2}:\d{2}$/.test(String(p.startTime || ''))) throw new Error('Choose a start time.');
  if (!(Number(p.lengthMin) > 0)) throw new Error('Enter a meeting length.');
  if (!String(p.clientName || '').trim()) throw new Error('Enter the client\'s name.');
  if (!isValidEmail_(p.clientEmail)) throw new Error('Enter a valid client email address.');
  const locs = [LOCATION_FORMAT.IN_PERSON, LOCATION_FORMAT.PHONE, LOCATION_FORMAT.VIDEO];
  if (locs.indexOf(p.locationFormat) === -1) throw new Error('Choose a location/format.');
}

/**
 * Create a booking (manager only). Converts the local date+time to epoch in the
 * business timezone, re-validates inside the lock, writes the booking with a
 * buffer snapshot, and audits it.
 * @param {Object} payload {userId,date,startTime,lengthMin,clientName,clientEmail,clientPhone,purposeNotes,locationFormat,meetingType}
 * @return {{bookingId:string}}
 */
function createBooking(payload) {
  const ctx = requireManager();
  validateBookingPayload_(payload);
  const tz = getTz();
  const startMs = parseLocalDateTime_(payload.date, payload.startTime, tz);

  return withScriptLock(function () {
    const v = validateBooking(payload.userId, startMs, payload.lengthMin, null, { nowMs: Date.now() });
    if (!v.ok) throw new Error(v.reason);
    const id = Utilities.getUuid();
    const now = Date.now();
    const row = {
      bookingId: id, userId: String(payload.userId),
      clientName: String(payload.clientName).trim(),
      clientEmail: String(payload.clientEmail).trim(),
      clientPhone: String(payload.clientPhone || '').trim(),
      purposeNotes: String(payload.purposeNotes || ''),
      locationFormat: payload.locationFormat,
      meetingType: String(payload.meetingType || ''),
      startMs: startMs, endMs: v.endMs,
      bufferBeforeMin: v.bufferMin, bufferAfterMin: v.bufferMin,
      status: BOOKING_STATUS.CONFIRMED, flag: BOOKING_FLAG.NONE, flagReason: '',
      reminderSent: false, reminderSentAt: '',
      createdBy: ctx.userId, createdAtMs: now, updatedBy: ctx.userId, updatedAtMs: now, cancelReason: ''
    };
    appendObject(SHEETS.BOOKINGS, row);
    logAudit({ entityType: ENTITY.BOOKING, entityId: id, action: AUDIT_ACTION.BOOK,
               actorUserId: ctx.userId, actorEmail: ctx.email, atMs: now, after: bookingAudit_(row) });
    SpreadsheetApp.flush();
    return { bookingId: id };
  });
}

/** Compact booking snapshot for the audit log. @private */
function bookingAudit_(b) {
  return { userId: b.userId, clientName: b.clientName, startMs: b.startMs, endMs: b.endMs,
           status: b.status, meetingType: b.meetingType };
}

/* ------------------------------- calendar reads --------------------------- */

/** {userId: colorHex} for calendar lanes. @private */
function getUserColorMap_() {
  const m = {};
  readObjects(SHEETS.USERS).forEach(function (u) { m[String(u.userId)] = String(u.colorHex || '#1a73e8'); });
  return m;
}

/** ISO without offset (naive business-tz wall-clock) for FullCalendar (timeZone:'UTC'). @private */
function isoNaive_(ms, tz) { return formatLocal(ms, "yyyy-MM-dd'T'HH:mm:ss", tz); }

/**
 * Confirmed bookings as FullCalendar events for [fromDate, toDate) — toDate is
 * EXCLUSIVE (matches FullCalendar's range). Manager only.
 */
function getCalendarBookings(fromDateStr, toDateStr) {
  requireManager();
  const tz = getTz();
  const ws = parseLocalDateTime_(fromDateStr, '00:00', tz);
  const we = parseLocalDateTime_(toDateStr, '00:00', tz); // exclusive
  const umap = getUserMap_(), cmap = getUserColorMap_();
  return readObjects(SHEETS.BOOKINGS)
    .filter(function (b) {
      return String(b.status) === BOOKING_STATUS.CONFIRMED && Number(b.endMs) > ws && Number(b.startMs) < we;
    })
    .map(function (b) {
      const flagged = String(b.flag) === BOOKING_FLAG.TIMEOFF_CONFLICT;
      const emp = umap[String(b.userId)] || '';
      return {
        id: String(b.bookingId),
        title: (flagged ? '⚠ ' : '') + emp + ' · ' + String(b.clientName || ''),
        start: isoNaive_(Number(b.startMs), tz), end: isoNaive_(Number(b.endMs), tz),
        color: cmap[String(b.userId)] || '#1a73e8',
        classNames: flagged ? ['flagged'] : [],
        extendedProps: {
          employee: emp, clientName: String(b.clientName || ''), clientEmail: String(b.clientEmail || ''),
          clientPhone: String(b.clientPhone || ''), meetingType: String(b.meetingType || ''),
          locationFormat: String(b.locationFormat || ''), purposeNotes: String(b.purposeNotes || ''),
          flag: String(b.flag || 'NONE'), flagReason: String(b.flagReason || '')
        }
      };
    });
}
