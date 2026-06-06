/**
 * SheetDAL.gs — the single choke point for all Sheet I/O.
 *
 * Principles:
 *  - Read each tab in ONE getValues() call and filter in memory (Sheets API
 *    round-trips, not CPU, are the bottleneck).
 *  - Map rows to objects via the LIVE header row, so manual column reordering in
 *    the Sheet does not corrupt reads.
 *  - Cache hot reads in CacheService (short TTL); always invalidate on write.
 *  - Serialize the booking write-path with LockService (see withScriptLock).
 *
 * Nothing here knows business rules — it's pure storage.
 */

/** @return {string} the data spreadsheet id from Script Properties. */
function getSheetId_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROP_SHEET_ID);
  if (!id) {
    throw new Error('SHEET_ID is not set. Run Setup.setup() once to create and link the data spreadsheet.');
  }
  return id;
}

/** @return {Spreadsheet} */
function getSpreadsheet_() {
  return SpreadsheetApp.openById(getSheetId_());
}

/** @return {Sheet} */
function getSheet_(name) {
  const sh = getSpreadsheet_().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet/tab: "' + name + '". Run Setup.setup().');
  return sh;
}

function cacheKey_(name) { return 'tab::' + name; }

/**
 * Read all data rows of a tab as objects keyed by the live header row.
 * Values are returned as native types from Sheets (numbers, booleans, strings).
 * @param {string} name tab name
 * @param {{noCache?: boolean}} [opts]
 * @return {Array<Object>}
 */
function readObjects(name, opts) {
  opts = opts || {};
  if (!opts.noCache) {
    const cached = _cacheGet_(cacheKey_(name));
    if (cached) return cached;
  }
  const sh = getSheet_(name);
  const range = sh.getDataRange();
  const values = range.getValues();
  if (values.length < 2) return []; // header only / empty
  const headers = values[0].map(String);
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    // Skip fully-blank rows.
    if (row.every(function (c) { return c === '' || c === null; })) continue;
    const obj = { _row: r + 1 }; // 1-based sheet row index for in-place updates
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = row[c];
    out.push(obj);
  }
  if (!opts.noCache) _cachePut_(cacheKey_(name), out);
  return out;
}

/**
 * Append one object as a row, ordered by the tab's HEADERS definition.
 * Missing fields are written as ''. Returns the written object.
 * @param {string} name
 * @param {Object} obj
 * @return {Object}
 */
function appendObject(name, obj) {
  const sh = getSheet_(name);
  const headers = HEADERS[name];
  if (!headers) throw new Error('No HEADERS defined for tab: ' + name);
  const row = headers.map(function (h) {
    const v = obj[h];
    return (v === undefined || v === null) ? '' : v;
  });
  sh.appendRow(row);
  invalidateTab(name);
  return obj;
}

/**
 * Update specific fields of the row whose PK column equals `idValue`.
 * Reads with noCache to find the freshest row. Returns true if a row was updated.
 * @param {string} name
 * @param {string} idValue
 * @param {Object} patch  field -> new value
 * @return {boolean}
 */
function updateById(name, idValue, patch) {
  const pkCol = PK[name];
  if (!pkCol) throw new Error('No PK defined for tab: ' + name);
  const sh = getSheet_(name);
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  const pkIdx = headers.indexOf(pkCol);
  if (pkIdx === -1) throw new Error('PK column "' + pkCol + '" not found in ' + name);

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][pkIdx]) === String(idValue)) {
      Object.keys(patch).forEach(function (field) {
        const c = headers.indexOf(field);
        if (c === -1) throw new Error('Unknown column "' + field + '" for ' + name);
        const v = patch[field];
        sh.getRange(r + 1, c + 1).setValue((v === undefined || v === null) ? '' : v);
      });
      invalidateTab(name);
      return true;
    }
  }
  return false;
}

/** Find a single object by PK (or null). Always reads fresh. */
function findById(name, idValue) {
  const pkCol = PK[name];
  const rows = readObjects(name, { noCache: true });
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][pkCol]) === String(idValue)) return rows[i];
  }
  return null;
}

/* ----------------------------- caching ----------------------------------- */

function _cacheGet_(key) {
  try {
    const raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function _cachePut_(key, value) {
  try {
    const ttl = Number(getConfig('cacheTtlSec')) || DEFAULTS.cacheTtlSec;
    const raw = JSON.stringify(value);
    if (raw.length < 95000) CacheService.getScriptCache().put(key, raw, ttl); // ~100KB cap
  } catch (e) { /* cache is advisory; ignore */ }
}

/** Invalidate one tab's cache (call after any write). */
function invalidateTab(name) {
  try { CacheService.getScriptCache().remove(cacheKey_(name)); } catch (e) {}
}

/** Invalidate everything (used by Setup and bulk operations). */
function invalidateAll() {
  try {
    CacheService.getScriptCache().removeAll(Object.keys(SHEETS).map(function (k) { return cacheKey_(SHEETS[k]); }));
  } catch (e) {}
  clearConfigMemo_();
}

/* ----------------------------- locking ----------------------------------- */

/**
 * Run `fn` while holding the script lock. Used to serialize the read-validate-
 * write critical section so concurrent bookings can't double-book.
 * Flushes pending Sheet writes before releasing so the next holder reads
 * committed state.
 * @param {function():*} fn
 * @return {*}
 */
function withScriptLock(fn) {
  const lock = LockService.getScriptLock();
  const timeout = Number(getConfig('lockTimeoutMs')) || DEFAULTS.lockTimeoutMs;
  if (!lock.tryLock(timeout)) {
    throw new Error('The system is busy, please try again in a moment.');
  }
  try {
    SpreadsheetApp.flush(); // read freshest committed data inside the lock
    return fn();
  } finally {
    try { SpreadsheetApp.flush(); } catch (e) {}
    lock.releaseLock();
  }
}
