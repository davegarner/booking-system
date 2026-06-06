/**
 * Config.gs — runtime configuration.
 *
 * Two layers:
 *  1. Script Properties hold the SHEET_ID of the standalone data spreadsheet
 *     (set by Setup.setup(), or manually).
 *  2. The `Config` tab holds editable business settings as key/value rows,
 *     falling back to DEFAULTS below when a key is missing.
 */

const PROP_SHEET_ID = 'SHEET_ID';

/** Fallback values used when the Config tab has no row for a key. */
const DEFAULTS = {
  timeZone: 'Europe/London',   // business timezone — all wall-clock rules resolve in this zone
  defaultBufferMin: 15,        // per-employee buffer fallback (minutes)
  bookingHorizonDays: 180,     // how far ahead a booking may be made
  reminderLeadHours: 24,       // how long before a meeting the reminder email fires
  cacheTtlSec: 45,             // CacheService TTL for hot tab reads
  lockTimeoutMs: 15000,        // LockService wait before giving up
  companyName: 'FSW',
  fromName: 'FSW Booking'
};

/** Numeric config keys — values coerced to Number on read. */
const NUMERIC_CONFIG = ['defaultBufferMin', 'bookingHorizonDays', 'reminderLeadHours', 'cacheTtlSec', 'lockTimeoutMs'];

/**
 * Read a single config value (Config tab first, then DEFAULTS).
 * @param {string} key
 * @return {*}
 */
function getConfig(key) {
  const all = getAllConfig_();
  const val = (key in all) ? all[key] : DEFAULTS[key];
  if (NUMERIC_CONFIG.indexOf(key) !== -1) return Number(val);
  return val;
}

/** Convenience: the business timezone string (IANA). */
function getTz() {
  return String(getConfig('timeZone') || DEFAULTS.timeZone);
}

/**
 * Build the {key: value} map from the Config tab, merged over DEFAULTS.
 * Cached for the duration of one execution via a module-level memo, plus a
 * short CacheService TTL across executions.
 * @private
 */
let _configMemo = null;
function getAllConfig_() {
  if (_configMemo) return _configMemo;
  const merged = Object.assign({}, DEFAULTS);
  try {
    // noCache: reading the Config tab through the cache path would recurse
    // (cache writes consult getConfig('cacheTtlSec')). It's tiny and memoized below.
    const rows = readObjects(SHEETS.CONFIG, { noCache: true }); // [{key, value}, ...]
    rows.forEach(function (r) {
      if (r.key !== '' && r.key != null) merged[String(r.key)] = r.value;
    });
  } catch (e) {
    // Config tab may not exist before Setup.setup() runs — DEFAULTS are fine.
  }
  _configMemo = merged;
  return merged;
}

/** Clear the in-execution config memo (call after writing Config rows). */
function clearConfigMemo_() {
  _configMemo = null;
}
