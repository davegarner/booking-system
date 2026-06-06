# Configuration

The FSW Booking System reads its runtime settings from two places:

1. **Script Properties** — holds the `SHEET_ID` that points the script at its standalone data spreadsheet.
2. **The `Config` tab** — a simple key/value sheet holding editable business settings, with built-in fallbacks (`DEFAULTS`) used whenever a key is missing.

This page is the reference for both layers. For where these settings sit in the wider system see [[Architecture]]; for first-time setup see [[Getting Started]] and [[Deployment]].

---

## Two configuration layers

### Layer 1 — `SHEET_ID` in Script Properties

The constant `PROP_SHEET_ID = 'SHEET_ID'` names the single Script Property the code relies on. It contains the spreadsheet ID of the standalone data spreadsheet that holds every tab in the [[Data Model]].

- It is normally set automatically by `Setup.setup()`, or it can be set manually in the Apps Script editor under **Project Settings → Script Properties**.
- Without a valid `SHEET_ID` the script cannot open its data spreadsheet, so this is the first thing to verify when nothing reads or writes correctly (see [[Troubleshooting]]).

`SHEET_ID` is **not** stored on the `Config` tab — it must live in Script Properties so the code knows which spreadsheet to open before it can read any tab.

### Layer 2 — the `Config` tab

The `Config` tab (sheet name `Config`, defined in `SHEETS.CONFIG`) stores business settings as rows. Its columns are exactly:

| Column | Meaning |
|--------|---------|
| `key`  | the setting name (must match a key below) |
| `value`| the value for that setting |

These two columns come from `HEADERS.Config = ['key', 'value']` in `Schema.gs`.

---

## How defaults vs Config-tab values work

Every setting has a hard-coded fallback in the `DEFAULTS` object in `Config.gs`. At read time:

1. `getAllConfig_()` starts from a copy of `DEFAULTS`.
2. It reads the rows of the `Config` tab and overlays each `key`/`value` pair on top of the defaults (blank or null keys are skipped).
3. `getConfig(key)` returns the Config-tab value if present, otherwise the default.

So **a row on the `Config` tab always overrides the matching default**, and any key you do not list simply uses its default. If the `Config` tab does not yet exist (for example before `Setup.setup()` has run), the read fails quietly and `DEFAULTS` are used as-is.

### Numeric coercion

The keys listed in `NUMERIC_CONFIG` are coerced to `Number` on read:

```text
defaultBufferMin, bookingHorizonDays, reminderLeadHours, cacheTtlSec, lockTimeoutMs
```

This means you can type these values as plain numbers on the `Config` tab and they will be read back as numbers, not strings.

---

## Config key reference

All keys, their defaults (from `DEFAULTS`), and their effect:

| Key | Default | Type | Effect |
|-----|---------|------|--------|
| `timeZone` | `Europe/London` | string (IANA) | Business timezone. All wall-clock rules (availability times, day boundaries) resolve in this zone. See [[Availability Engine]]. |
| `defaultBufferMin` | `15` | number (minutes) | Per-employee buffer fallback. Used when an employee has no explicit `bufferMin`. |
| `bookingHorizonDays` | `180` | number (days) | How far ahead a booking may be made. See [[Booking and Concurrency]]. |
| `reminderLeadHours` | `24` | number (hours) | How long before a meeting the reminder email fires. See [[Notifications]]. |
| `cacheTtlSec` | `45` | number (seconds) | CacheService TTL for hot tab reads. |
| `lockTimeoutMs` | `15000` | number (ms) | How long `LockService` waits for a lock before giving up. See [[Booking and Concurrency]]. |
| `companyName` | `FSW` | string | Company name used in user-facing text. |
| `fromName` | `FSW Booking` | string | Display "from" name on outgoing emails. See [[Notifications]]. |

### Notes on individual keys

- **`defaultBufferMin`** is only the fallback. An individual employee's buffer comes from the `bufferMin` column on the `Users` tab (see [[Data Model]]); when a booking is made, the buffer is snapshotted into `bufferBeforeMin`/`bufferAfterMin` on the `Bookings` row.
- **`reminderLeadHours`** controls only the timing of the reminder, not whether reminders run at all — delivery depends on the reminder trigger described in [[Notifications]].
- **`lockTimeoutMs`** and **`cacheTtlSec`** are performance/correctness knobs; raise `lockTimeoutMs` if you see lock contention under load, and adjust `cacheTtlSec` to trade freshness against read cost.

---

## Reading config from code

Two helpers in `Config.gs` are used throughout the codebase (see [[API Reference]] and [[Developer Guide]]):

| Function | Returns |
|----------|---------|
| `getConfig(key)` | The value for `key` (Config tab first, then `DEFAULTS`), coerced to `Number` for numeric keys. |
| `getTz()` | Convenience wrapper returning the business timezone string, falling back to `DEFAULTS.timeZone`. |

```javascript
const horizon = getConfig('bookingHorizonDays'); // Number, e.g. 180
const tz = getTz();                              // 'Europe/London'
```

---

## Caching behaviour

Config reads are cached on two levels so the `Config` tab is not re-read on every call:

1. **In-execution memo** — `getAllConfig_()` stores the merged map in a module-level variable `_configMemo`. Within a single script execution, the `Config` tab is read at most once.
2. **CacheService TTL** — general hot tab reads are cached via `CacheService` for `cacheTtlSec` seconds, so config values can persist briefly across executions too.

One deliberate subtlety: the `Config` tab itself is read with `{ noCache: true }`. Routing it through the normal cache path would recurse, because cache writes consult `getConfig('cacheTtlSec')`. The tab is tiny and the memo covers repeat reads within an execution, so this is safe.

### Invalidating the memo

After writing rows to the `Config` tab, call `clearConfigMemo_()` to drop `_configMemo`, otherwise the current execution keeps serving the old, merged values. Note that the cross-execution `CacheService` entries still expire on their own TTL.

---

## Changing the business timezone safely

The timezone appears in **three** places, and they must all agree or wall-clock times will drift:

1. **`Config` tab** — the `timeZone` key (read by `getTz()` / `getConfig('timeZone')`). This is what the availability and booking logic uses for wall-clock rules.
2. **The script manifest** (`appsscript.json`) — the project's `timeZone` field, which governs Apps Script's own date handling and triggers.
3. **The spreadsheet** — the data spreadsheet's File → Settings timezone.

To change the business timezone:

1. Update the `timeZone` row on the `Config` tab to the new IANA name (for example `America/New_York`).
2. Update the `timeZone` in the script manifest to match.
3. Update the spreadsheet's timezone (File → Settings) to match.
4. Clear caches so stale values are not served — let `cacheTtlSec` expire, or trigger `clearConfigMemo_()` on the next write.

If these three disagree, availability windows and booking boundaries will be computed against one zone while triggers or stored interpretations assume another. Because all instants are stored as **UTC epoch-milliseconds** (see the conventions in [[Data Model]]), stored data itself is unaffected — but how those instants map to wall-clock hours will be wrong until all three agree.

> **Heads-up:** changing the timezone does **not** rewrite existing rows. It changes how `startTimeLocal`/`endTimeLocal` and day boundaries are interpreted going forward, which can shift apparent availability for existing rules.

---

## Related pages

- [[Getting Started]] — initial setup and `Setup.setup()`.
- [[Deployment]] — installing the script and setting `SHEET_ID`.
- [[Data Model]] — the `Config` tab and all other tabs.
- [[Availability Engine]] — how `timeZone` and buffers drive availability.
- [[Booking and Concurrency]] — `bookingHorizonDays` and `lockTimeoutMs`.
- [[Notifications]] — `reminderLeadHours`, `fromName`.
- [[Troubleshooting]] — what to check when config values are not applied.
