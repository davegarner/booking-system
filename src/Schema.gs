/**
 * Schema.gs — single source of truth for the data model.
 *
 * Every tab name, column order, and enum lives here. SheetDAL writes rows in
 * the column order defined by HEADERS, and reads by mapping the live header row
 * back to these names (so manual column reordering in the Sheet won't break us).
 *
 * Conventions:
 *  - All instants are stored as UTC epoch-milliseconds INTEGERS in *Ms columns.
 *  - All IDs are UUID strings (Utilities.getUuid()).
 *  - Intervals are half-open: [startMs, endMs).
 *  - `active` is a real boolean; cancel/soft-delete sets it false (rows are kept).
 */

const SHEETS = {
  CONFIG: 'Config',
  USERS: 'Users',
  RULES: 'AvailabilityRules',
  ADDITIONS: 'AvailabilityAdditions',
  EXCEPTIONS: 'AvailabilityExceptions',
  TIME_OFF: 'TimeOff',
  CLOSURES: 'Closures',
  BOOKINGS: 'Bookings',
  AUDIT: 'AuditLog'
};

/** Canonical column order per tab. Row 1 of each sheet uses exactly these headers. */
const HEADERS = {
  Config: ['key', 'value'],

  Users: ['userId', 'email', 'displayName', 'role', 'bufferMin', 'recurrenceMode', 'active', 'colorHex'],

  AvailabilityRules: [
    'ruleId', 'userId', 'freq',
    'dayOfWeek',                       // WEEKLY: 0=Mon .. 6=Sun
    'monthlyMode', 'dayOfMonth',       // MONTHLY/DOM
    'nth', 'nthDayOfWeek',             // MONTHLY/NTH_DOW (nth=-1 => last)
    'startTimeLocal', 'endTimeLocal',  // "HH:mm" wall-clock in business tz
    'effectiveFromMs', 'effectiveToMs',// active window (epoch-ms, inclusive). Empty effectiveTo = open-ended
    'active'
  ],

  AvailabilityAdditions: ['additionId', 'userId', 'startMs', 'endMs', 'note', 'active'],

  AvailabilityExceptions: ['exceptionId', 'userId', 'startMs', 'endMs', 'note', 'active'],

  TimeOff: ['timeOffId', 'userId', 'scope', 'startMs', 'endMs', 'reason', 'createdBy', 'createdAtMs', 'active'],

  Closures: ['closureId', 'scope', 'startMs', 'endMs', 'reason', 'createdBy', 'createdAtMs', 'active'],

  Bookings: [
    'bookingId', 'userId',
    'clientName', 'clientEmail', 'clientPhone',
    'purposeNotes', 'locationFormat', 'meetingType',
    'startMs', 'endMs',
    'bufferBeforeMin', 'bufferAfterMin',   // snapshot of the employee's buffer at booking time
    'status', 'flag', 'flagReason',
    'reminderSent', 'reminderSentAt',
    'createdBy', 'createdAtMs', 'updatedBy', 'updatedAtMs',
    'cancelReason'
  ],

  AuditLog: ['auditId', 'entityType', 'entityId', 'action', 'actorUserId', 'actorEmail', 'atMs', 'reason', 'beforeJson', 'afterJson']
};

/**
 * Column-format hints applied by Setup.gs so Sheets never coerces our data.
 *  - 'text'  => '@'  : IDs, phone numbers, time strings (stop leading-zero/UUID mangling)
 *  - 'int'   => '0'  : epoch-ms and other integers (stop date/scientific coercion)
 */
const COLUMN_FORMATS = {
  text: ['userId', 'ruleId', 'additionId', 'exceptionId', 'timeOffId', 'closureId', 'bookingId', 'auditId',
         'entityId', 'actorUserId', 'createdBy', 'updatedBy',
         'clientPhone', 'startTimeLocal', 'endTimeLocal'],
  int:  ['startMs', 'endMs', 'effectiveFromMs', 'effectiveToMs', 'createdAtMs', 'updatedAtMs',
         'reminderSentAt', 'atMs', 'bufferMin', 'bufferBeforeMin', 'bufferAfterMin',
         'dayOfWeek', 'dayOfMonth', 'nth', 'nthDayOfWeek']
};

const ROLES = { EMPLOYEE: 'employee', MANAGER: 'manager' };

const FREQ = { WEEKLY: 'WEEKLY', MONTHLY: 'MONTHLY' };

const MONTHLY_MODE = { DOM: 'DOM', NTH_DOW: 'NTH_DOW' };

const TIMEOFF_SCOPE = { FULL_DAY: 'FULL_DAY', PARTIAL: 'PARTIAL' };

const LOCATION_FORMAT = { IN_PERSON: 'IN_PERSON', PHONE: 'PHONE', VIDEO: 'VIDEO' };

const BOOKING_STATUS = { CONFIRMED: 'CONFIRMED', CANCELLED: 'CANCELLED' };

const BOOKING_FLAG = { NONE: 'NONE', TIMEOFF_CONFLICT: 'TIMEOFF_CONFLICT' };

const AUDIT_ACTION = {
  BOOK: 'BOOK', RESCHEDULE: 'RESCHEDULE', CANCEL: 'CANCEL', FLAG: 'FLAG', UNFLAG: 'UNFLAG',
  CREATE: 'CREATE', UPDATE: 'UPDATE', DELETE: 'DELETE'
};

const ENTITY = {
  BOOKING: 'BOOKING', TIMEOFF: 'TIMEOFF', CLOSURE: 'CLOSURE',
  RULE: 'RULE', ADDITION: 'ADDITION', EXCEPTION: 'EXCEPTION', USER: 'USER'
};

/** Primary-key column name for each tab (used by SheetDAL.updateById). */
const PK = {
  Users: 'userId',
  AvailabilityRules: 'ruleId',
  AvailabilityAdditions: 'additionId',
  AvailabilityExceptions: 'exceptionId',
  TimeOff: 'timeOffId',
  Closures: 'closureId',
  Bookings: 'bookingId',
  AuditLog: 'auditId'
};

const MS_PER_MIN = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MIN;
const MS_PER_DAY = 24 * MS_PER_HOUR;
