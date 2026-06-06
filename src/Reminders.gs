/**
 * Reminders.gs — the scheduled reminder job.
 *
 * `sendDueReminders` is run hourly by a time-driven trigger (see Triggers.gs).
 * It finds confirmed meetings that start within the reminder lead time and
 * haven't been reminded yet, emails the client + employee, and marks each as
 * reminded so it's never sent twice. Reschedule resets `reminderSent`, so a moved
 * meeting gets a fresh reminder for its new time.
 */

/** Send reminders for meetings due within the lead window. @return {number} count sent */
function sendDueReminders() {
  const now = Date.now();
  const leadMs = (Number(getConfig('reminderLeadHours')) || DEFAULTS.reminderLeadHours) * MS_PER_HOUR;
  const horizon = now + leadMs;

  const due = readObjects(SHEETS.BOOKINGS, { noCache: true }).filter(function (b) {
    return String(b.status) === BOOKING_STATUS.CONFIRMED &&
           !truthy_(b.reminderSent) &&
           Number(b.startMs) > now &&
           Number(b.startMs) <= horizon;
  });

  let sent = 0;
  due.forEach(function (b) {
    notifyBooking_(b, 'REMINDER', {});
    updateById(SHEETS.BOOKINGS, String(b.bookingId), { reminderSent: true, reminderSentAt: now });
    sent++;
  });
  if (sent) Logger.log('sendDueReminders: ' + sent + ' reminder(s) sent.');
  return sent;
}
