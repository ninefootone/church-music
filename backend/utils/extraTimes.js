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

// '11:00' / '11:00:00' → '11:00 am' (matches the web's en-GB format). For emails.
function formatClock(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':');
  const hour = parseInt(h, 10);
  if (!Number.isFinite(hour)) return '';
  return `${hour % 12 || 12}:${m} ${hour < 12 ? 'am' : 'pm'}`;
}

// "9:15 am & 11:00 am" — plan_start_time (or plan_time) plus extra_times.
function planTimeLabel(plan) {
  const first = plan.plan_start_time ? formatClock(plan.plan_start_time) : (plan.plan_time || '');
  if (!first) return '';
  return [first, ...(plan.extra_times || []).map(formatClock)].join(' & ');
}

module.exports = { parseExtraTimes, MAX_EXTRA_TIMES, formatClock, planTimeLabel };
