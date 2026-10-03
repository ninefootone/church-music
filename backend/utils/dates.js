// Date/time input checks, so a missing or malformed value gets a 400 with a message
// instead of reaching Postgres and coming back as a 500.

// A real calendar date as 'YYYY-MM-DD' (rejects 2026-02-30). Also accepts a full ISO
// timestamp ('2026-10-04T00:00:00.000Z'): node-pg returns DATE columns as JS Dates, so
// the plan builder sends back what it loaded in that form. Callers pass the value on
// unchanged; Postgres casts it as before.
function isIsoDate(v) {
  if (typeof v !== 'string') return false;
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ][0-9:.]+(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/.exec(v);
  if (!m) return false;
  const d = new Date(`${m[1]}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === m[1];
}

// 'HH:MM' or 'HH:MM:SS', 24-hour (what <input type="time"> sends and Postgres TIME returns).
function isClockTime(v) {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v);
}

const DATE_MESSAGE = 'Please choose a valid date';
const START_TIME_MESSAGE = 'Start time must be a time like 10:30';

module.exports = { isIsoDate, isClockTime, DATE_MESSAGE, START_TIME_MESSAGE };
