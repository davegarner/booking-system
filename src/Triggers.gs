/**
 * Triggers.gs — install/remove the time-driven reminder job.
 *
 * Run `installTriggers()` once (Setup.setup() also calls it). It is idempotent:
 * it removes any existing reminder triggers first, so re-running never stacks
 * duplicates (Apps Script caps triggers per script).
 */

const REMINDER_HANDLER = 'sendDueReminders';

/** Install the hourly reminder trigger (delete-then-create). */
function installTriggers() {
  removeTriggers();
  ScriptApp.newTrigger(REMINDER_HANDLER).timeBased().everyHours(1).create();
  Logger.log('Installed hourly "' + REMINDER_HANDLER + '" trigger.');
  return true;
}

/** Remove any reminder triggers owned by this script/user. */
function removeTriggers() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === REMINDER_HANDLER) { ScriptApp.deleteTrigger(t); removed++; }
  });
  if (removed) Logger.log('Removed ' + removed + ' existing "' + REMINDER_HANDLER + '" trigger(s).');
  return removed;
}
