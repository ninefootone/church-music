// Multi-service plans (2026-10-24, project doc multi-service-plans.md): extra_times are further
// start times for an IDENTICAL repeat of a plan (plan_start_time is the first service). CCLI export
// and stats count each song once per service. Used by plans and plan templates.
const { isClockTime, START_TIME_MESSAGE } = require('./dates');

const MAX_EXTRA_TIMES = 3;
function parseExtraTimes(value) {
  if (value === null || value === undefined) return { value: [] };
  if (!Array.isArray(value)) return { error: 'Extra service times must be a list of times' };
  const times = [];
  for (const t of value) {
    if (t === '' || t === null) continue;
    if (!isClockTime(t)) return { error: START_TIME_MESSAGE };
    const hhmm = t.slice(0, 5);
    if (!times.includes(hhmm)) times.push(hhmm);
  }
  if (times.length > MAX_EXTRA_TIMES) return { error: `A plan can have at most ${MAX_EXTRA_TIMES} extra service times` };
  times.sort();
  return { value: times };
}

module.exports = { parseExtraTimes, MAX_EXTRA_TIMES };
