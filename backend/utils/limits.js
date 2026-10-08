// Free-plan limits, shared so every way of adding a song/plan applies the same rule.
// (Discover import used to skip the song limit; plan duplicate used to skip the plan limit.)
// free_access churches are exempt. A cancelled subscription ('canceled') is back on the
// free plan. Sample content (is_sample = TRUE, seeded into every
// new church) never counts towards either limit.

const FREE_SONG_LIMIT = 5;
const FREE_PLAN_LIMIT = 1;
const SONG_LIMIT_MESSAGE = `You have reached the ${FREE_SONG_LIMIT} song limit on the free plan. Upgrade in Settings to add more.`;
const PLAN_LIMIT_MESSAGE = `You have reached the ${FREE_PLAN_LIMIT} plan limit on the free plan. Upgrade in Settings to add more.`;

async function isFreePlan(db, churchId) {
  const church = await db.query('SELECT subscription_status, free_access FROM churches WHERE id = $1', [churchId]);
  const status = church.rows[0]?.subscription_status;
  const freeAccess = church.rows[0]?.free_access;
  return !freeAccess && (!status || status === 'free' || status === 'canceled');
}

// True when the church is on the free plan and already has FREE_SONG_LIMIT songs of its own.
async function songLimitReached(db, churchId) {
  if (!(await isFreePlan(db, churchId))) return false;
  const count = await db.query('SELECT COUNT(*) FROM songs WHERE church_id = $1 AND NOT is_sample', [churchId]);
  return parseInt(count.rows[0].count, 10) >= FREE_SONG_LIMIT;
}

// True when the church is on the free plan and already has FREE_PLAN_LIMIT plans of its own.
async function planLimitReached(db, churchId) {
  if (!(await isFreePlan(db, churchId))) return false;
  const count = await db.query('SELECT COUNT(*) FROM plans WHERE church_id = $1 AND NOT is_sample', [churchId]);
  return parseInt(count.rows[0].count, 10) >= FREE_PLAN_LIMIT;
}

module.exports = {
  FREE_SONG_LIMIT, FREE_PLAN_LIMIT, SONG_LIMIT_MESSAGE, PLAN_LIMIT_MESSAGE,
  isFreePlan, songLimitReached, planLimitReached,
};
