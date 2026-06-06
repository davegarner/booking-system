/**
 * Setup.gs — one-time (and idempotent) bootstrap, run from the Apps Script editor.
 *
 * `setup()` creates the standalone data spreadsheet (if not already linked),
 * builds every tab with the correct headers and column formats, seeds Config
 * defaults, and registers the running user as the first manager. Safe to re-run:
 * it never overwrites existing Config rows or users, and only adds missing tabs.
 *
 * After running, copy the logged spreadsheet URL and add your employees with
 * addEmployee(...).
 */

/** Create/repair the data spreadsheet and seed initial rows. @return {string} spreadsheet URL */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(PROP_SHEET_ID);
  let ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('FSW Booking System — Data');
    id = ss.getId();
    props.setProperty(PROP_SHEET_ID, id);
  }

  Object.keys(HEADERS).forEach(function (tab) { ensureSheet_(ss, tab, HEADERS[tab]); });

  // Drop the default empty "Sheet1" Google adds to new spreadsheets.
  const def = ss.getSheetByName('Sheet1');
  if (def && !HEADERS['Sheet1'] && ss.getSheets().length > 1) ss.deleteSheet(def);

  seedConfig_();
  seedManager_();
  invalidateAll();

  const url = ss.getUrl();
  Logger.log('✅ Setup complete.\nData spreadsheet: ' + url +
             '\nManager seeded: ' + (Session.getActiveUser().getEmail() || '(unknown)') +
             '\nNext: add employees with addEmployee("name@domain","Full Name").');
  return url;
}

/** Create a tab if missing; (re)write its header row, freeze it, and format columns. @private */
function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sh.setFrozenRows(1);
  const rows = sh.getMaxRows();
  headers.forEach(function (h, i) {
    const col = i + 1;
    if (COLUMN_FORMATS.text.indexOf(h) !== -1) sh.getRange(1, col, rows, 1).setNumberFormat('@');
    else if (COLUMN_FORMATS.int.indexOf(h) !== -1) sh.getRange(1, col, rows, 1).setNumberFormat('0');
  });
}

/** Seed Config defaults only if the tab is empty. @private */
function seedConfig_() {
  if (readObjects(SHEETS.CONFIG, { noCache: true }).length > 0) return;
  Object.keys(DEFAULTS).forEach(function (k) {
    appendObject(SHEETS.CONFIG, { key: k, value: DEFAULTS[k] });
  });
  clearConfigMemo_();
}

/** Register the running user as the first manager, only if Users is empty. @private */
function seedManager_() {
  if (readObjects(SHEETS.USERS, { noCache: true }).length > 0) return;
  const email = Session.getActiveUser().getEmail() || '';
  appendObject(SHEETS.USERS, {
    userId: Utilities.getUuid(),
    email: email,
    displayName: email ? email.split('@')[0] : 'Manager',
    role: ROLES.MANAGER,
    bufferMin: getConfig('defaultBufferMin'),
    recurrenceMode: FREQ.WEEKLY,
    active: true,
    colorHex: '#3366cc'
  });
}

/**
 * Add an employee (or manager) to the roster. Run from the editor or wrap in a UI later.
 * @param {string} email Workspace login email
 * @param {string} displayName
 * @param {{role?:string, bufferMin?:number, recurrenceMode?:string, colorHex?:string}} [o]
 * @return {string} new userId
 */
function addEmployee(email, displayName, o) {
  o = o || {};
  if (!email) throw new Error('email is required');
  const existing = readObjects(SHEETS.USERS, { noCache: true })
    .filter(function (u) { return String(u.email).toLowerCase() === String(email).toLowerCase(); });
  if (existing.length) throw new Error('A user with that email already exists: ' + email);
  const userId = Utilities.getUuid();
  appendObject(SHEETS.USERS, {
    userId: userId,
    email: email,
    displayName: displayName || email.split('@')[0],
    role: o.role || ROLES.EMPLOYEE,
    bufferMin: (o.bufferMin != null) ? o.bufferMin : getConfig('defaultBufferMin'),
    recurrenceMode: o.recurrenceMode || FREQ.WEEKLY,
    active: true,
    colorHex: o.colorHex || pickColor_()
  });
  invalidateTab(SHEETS.USERS);
  Logger.log('Added ' + (o.role || ROLES.EMPLOYEE) + ': ' + email + ' (' + userId + ')');
  return userId;
}

/** Deterministic-ish color for calendar lanes (index-free, hash of email). @private */
function pickColor_() {
  const palette = ['#4285F4', '#EA4335', '#34A853', '#FBBC04', '#A142F4', '#24C1E0',
                   '#F538A0', '#FA7B17', '#1E8E3E', '#9334E6'];
  const n = readObjects(SHEETS.USERS, { noCache: true }).length;
  return palette[n % palette.length];
}

/** Convenience: log the linked data spreadsheet URL. */
function getDataSpreadsheetUrl() {
  const url = getSpreadsheet_().getUrl();
  Logger.log(url);
  return url;
}
