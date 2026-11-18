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

// ── Per-service items (2026-11-18, project doc per-service-items.md) ─────────────────────────
// plan_items.service_times TIME[] = the services (start times) an item happens at, on a plan with
// extra_times. '{}' = every service (the default, and what every item had before). Kept tidy by
// tidyItemServiceTimes: only times the plan actually has, and '{}' when that's all of them or none.

// The plan's services as 'HH:MM' strings: [start, ...extra]. [] when there's no start time.
function planServiceTimes(plan) {
  if (!plan || !plan.plan_start_time) return [];
  return [plan.plan_start_time, ...(plan.extra_times || [])].map((t) => String(t).slice(0, 5));
}

// Body value → { value: ['09:15', …] } | { error }. Absent → { value: undefined } (leave unchanged).
const MAX_SERVICE_TIMES = MAX_EXTRA_TIMES + 1;
function parseItemServiceTimes(value) {
  if (value === undefined) return { value: undefined };
  if (value === null) return { value: [] };
  if (!Array.isArray(value)) return { error: 'Service times must be a list of times' };
  const times = [];
  for (const t of value) {
    if (typeof t !== 'string' || !isClockTime(t)) return { error: START_TIME_MESSAGE };
    const hhmm = t.slice(0, 5);
    if (!times.includes(hhmm)) times.push(hhmm);
  }
  if (times.length > MAX_SERVICE_TIMES) return { error: `An item can be at most ${MAX_SERVICE_TIMES} service times` };
  times.sort();
  return { value: times };
}

// The plan times this item is at, or [] when it's at every service (also when its stored times
// don't match any of the plan's — treated as "every service", never as "no service").
function itemServiceTimes(item, plan) {
  const all = planServiceTimes(plan);
  const mine = (item.service_times || []).map((t) => String(t).slice(0, 5)).filter((t) => all.includes(t));
  return mine.length === 0 || mine.length >= all.length ? [] : mine;
}

// "9:15 am only" / "9:15 am & 11:00 am only", or null for an every-service item.
function serviceOnlyLabel(item, plan) {
  const times = itemServiceTimes(item, plan);
  return times.length ? `${times.map(formatClock).join(' & ')} only` : null;
}

// Re-tidies every item of one plan against the plan's current times (after a save, a change of the
// plan's start/extra times, a duplicate, or a template copy). Times the plan no longer has are
// dropped; an item left with none, or with all of them, goes back to '{}' (every service).
async function tidyItemServiceTimes(db, planId) {
  await db.query(
    `WITH p AS (
       SELECT id, CASE WHEN plan_start_time IS NULL THEN '{}'::time[]
                       ELSE ARRAY[plan_start_time] || extra_times END AS times
         FROM plans WHERE id = $1
     ), k AS (
       SELECT i.id,
              ARRAY(SELECT DISTINCT t FROM unnest(i.service_times) t WHERE t = ANY(p.times) ORDER BY t) AS kept,
              cardinality(p.times) AS n
         FROM plan_items i JOIN p ON p.id = i.plan_id
        WHERE cardinality(i.service_times) > 0
     )
     UPDATE plan_items pi
        SET service_times = CASE WHEN cardinality(k.kept) = 0 OR cardinality(k.kept) >= k.n THEN '{}'::time[] ELSE k.kept END
       FROM k
      WHERE pi.id = k.id
        AND pi.service_times IS DISTINCT FROM
            (CASE WHEN cardinality(k.kept) = 0 OR cardinality(k.kept) >= k.n THEN '{}'::time[] ELSE k.kept END)`,
    [planId]
  );
}

module.exports = {
  parseExtraTimes, MAX_EXTRA_TIMES, formatClock, planTimeLabel,
  planServiceTimes, parseItemServiceTimes, itemServiceTimes, serviceOnlyLabel, tidyItemServiceTimes,
};
