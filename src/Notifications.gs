/**
 * Notifications.gs — transactional email via Google Workspace (MailApp).
 *
 * Sends on BOOK / RESCHEDULE / CANCEL (and REMINDER, see Reminders.gs):
 *   - the CLIENT gets a friendly confirmation (reply goes to the employee);
 *   - the assigned EMPLOYEE gets the operational details (client contact, notes);
 *   - the MANAGER(s) get a copy for oversight — except for reminders, which go to
 *     client + employee only (a daily manager copy of every reminder is noise;
 *     change here if you want manager reminders too).
 *
 * Sending happens AFTER the booking lock is released and is wrapped in try/catch
 * by callers, so email problems never affect a booking. Quota is checked first.
 */

/** Human label for a location/format. @private */
function locLabelServer_(v) {
  return v === LOCATION_FORMAT.IN_PERSON ? 'In person'
       : v === LOCATION_FORMAT.PHONE ? 'Phone'
       : v === LOCATION_FORMAT.VIDEO ? 'Video' : String(v || '');
}

/** HTML-escape. @private */
function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

/** Active manager emails. @private */
function managerEmails_() {
  return readObjects(SHEETS.USERS)
    .filter(function (u) { return truthy_(u.active) && String(u.role) === ROLES.MANAGER; })
    .map(function (u) { return String(u.email || ''); })
    .filter(function (e) { return e; });
}

/** Send one HTML+text email (best-effort, quota-guarded). @private */
function sendMail_(to, subject, htmlBody, textBody, replyTo) {
  if (!isValidEmail_(to)) return false;
  try {
    if (MailApp.getRemainingDailyQuota() <= 0) { Logger.log('Email quota exhausted; skipped ' + to); return false; }
    const msg = { to: to, subject: subject, body: textBody || '', htmlBody: htmlBody, name: safeConfig_('fromName', 'FSW Booking') };
    if (replyTo) msg.replyTo = replyTo;
    MailApp.sendEmail(msg);
    return true;
  } catch (e) { Logger.log('sendMail_ failed to ' + to + ': ' + e); return false; }
}

/** Build the detail rows shown in an email. @private */
function bookingRows_(b, audience, tz) {
  const employee = findById(SHEETS.USERS, String(b.userId));
  const empName = employee ? String(employee.displayName || '') : '';
  const when = formatHuman(Number(b.startMs), tz) + '–' + formatLocal(Number(b.endMs), 'HH:mm', tz);
  const rows = [];
  if (audience === 'client') rows.push(['With', empName]);
  rows.push(['When', when]);
  rows.push(['Format', locLabelServer_(b.locationFormat)]);
  if (b.meetingType) rows.push(['Type', String(b.meetingType)]);
  if (audience === 'staff') {
    rows.push(['Client', String(b.clientName || '')]);
    if (b.clientEmail) rows.push(['Client email', String(b.clientEmail)]);
    if (b.clientPhone) rows.push(['Client phone', String(b.clientPhone)]);
    if (b.purposeNotes) rows.push(['Notes', String(b.purposeNotes)]);
  }
  return rows;
}

/** Compose {subject, html, text} for an event + audience. @private */
function composeBookingEmail_(kind, audience, b, extra, tz) {
  extra = extra || {};
  const company = safeConfig_('companyName', 'FSW');
  const dateShort = formatLocal(Number(b.startMs), 'EEE d MMM, HH:mm', tz);
  const client = String(b.clientName || '');
  const rows = bookingRows_(b, audience, tz);
  let title, subject, intro = '';

  if (kind === 'BOOK') {
    title = audience === 'client' ? 'Your appointment is confirmed' : 'New booking';
    subject = audience === 'client' ? (company + ': appointment confirmed — ' + dateShort) : ('New booking: ' + client + ' — ' + dateShort);
    if (audience === 'client') intro = 'Hi ' + client + ', your appointment is booked.';
  } else if (kind === 'RESCHEDULE') {
    title = audience === 'client' ? 'Your appointment has moved' : 'Booking rescheduled';
    subject = audience === 'client' ? (company + ': appointment moved — ' + dateShort) : ('Rescheduled: ' + client + ' — ' + dateShort);
    if (audience === 'client') intro = 'Hi ' + client + ', your appointment has been rescheduled.';
    if (extra.oldWhen) rows.unshift(['Previously', extra.oldWhen]);
  } else if (kind === 'CANCEL') {
    title = audience === 'client' ? 'Your appointment has been cancelled' : 'Booking cancelled';
    subject = audience === 'client' ? (company + ': appointment cancelled — ' + dateShort) : ('Cancelled: ' + client + ' — ' + dateShort);
    if (audience === 'client') intro = 'Hi ' + client + ', your appointment has been cancelled.';
    if (extra.reason) rows.push(['Reason', extra.reason]);
  } else { // REMINDER
    title = audience === 'client' ? 'Appointment reminder' : 'Upcoming appointment';
    subject = audience === 'client' ? (company + ': reminder — ' + dateShort) : ('Reminder: ' + client + ' — ' + dateShort);
    if (audience === 'client') intro = 'Hi ' + client + ', this is a reminder of your upcoming appointment.';
  }
  return { subject: subject, html: emailHtml_(company, title, intro, rows), text: emailText_(title, intro, rows) };
}

/** Branded HTML body. @private */
function emailHtml_(company, title, intro, rows) {
  let h = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#202124;">';
  h += '<div style="font-size:18px;font-weight:bold;color:#1a73e8;">' + esc_(company) + ' Booking</div>';
  h += '<h2 style="font-size:18px;margin:12px 0 6px;">' + esc_(title) + '</h2>';
  if (intro) h += '<p style="margin:0 0 12px;">' + esc_(intro) + '</p>';
  h += '<table style="border-collapse:collapse;width:100%;font-size:14px;">';
  rows.forEach(function (r) {
    h += '<tr><td style="padding:6px 10px;color:#5f6368;border-bottom:1px solid #eee;">' + esc_(r[0]) +
         '</td><td style="padding:6px 10px;border-bottom:1px solid #eee;"><b>' + esc_(r[1]) + '</b></td></tr>';
  });
  h += '</table>';
  h += '<p style="color:#9aa0a6;font-size:12px;margin-top:16px;">Automated message from ' + esc_(company) + ' Booking.</p></div>';
  return h;
}

/** Plain-text fallback body. @private */
function emailText_(title, intro, rows) {
  let t = title + '\n\n';
  if (intro) t += intro + '\n\n';
  rows.forEach(function (r) { t += r[0] + ': ' + r[1] + '\n'; });
  return t;
}

/**
 * Send all the emails for a booking event.
 * @param {Object} b booking row
 * @param {string} kind 'BOOK' | 'RESCHEDULE' | 'CANCEL' | 'REMINDER'
 * @param {{oldWhen?:string, reason?:string}} [extra]
 */
function notifyBooking_(b, kind, extra) {
  try {
    const tz = getTz();
    const employee = findById(SHEETS.USERS, String(b.userId));
    const empEmail = employee ? String(employee.email || '') : '';

    if (isValidEmail_(b.clientEmail)) {
      const mc = composeBookingEmail_(kind, 'client', b, extra, tz);
      sendMail_(b.clientEmail, mc.subject, mc.html, mc.text, empEmail || null);
    }
    if (isValidEmail_(empEmail)) {
      const me = composeBookingEmail_(kind, 'staff', b, extra, tz);
      sendMail_(empEmail, me.subject, me.html, me.text, null);
    }
    if (kind !== 'REMINDER') { // managers: skip reminders to avoid daily noise
      const ms = composeBookingEmail_(kind, 'staff', b, extra, tz);
      managerEmails_().forEach(function (mgr) {
        if (mgr !== empEmail) sendMail_(mgr, ms.subject, ms.html, ms.text, null);
      });
    }
  } catch (e) { Logger.log('notifyBooking_ error: ' + e); }
}
