// Free-plan limits, shared so every way of adding a song/plan applies the same rule.
// (Discover import used to skip the song limit.) free_access churches are exempt.

const FREE_SONG_LIMIT = 5;
const SONG_LIMIT_MESSAGE = `You have reached the ${FREE_SONG_LIMIT} song limit on the free plan. Upgrade in Settings to add more.`;

async function isFreePlan(db, churchId) {
  const church = await db.query('SELECT subscription_status, free_access FROM churches WHERE id = $1', [churchId]);
  const status = church.rows[0]?.subscription_status;
  const freeAccess = church.rows[0]?.free_access;
  return !freeAccess && (!status || status === 'free');
}

// True when the church is on the free plan and already has FREE_SONG_LIMIT songs.
async function songLimitReached(db, churchId) {
  if (!(await isFreePlan(db, churchId))) return false;
  const count = await db.query('SELECT COUNT(*) FROM songs WHERE church_id = $1', [churchId]);
  return parseInt(count.rows[0].count, 10) >= FREE_SONG_LIMIT;
}

module.exports = { FREE_SONG_LIMIT, SONG_LIMIT_MESSAGE, isFreePlan, songLimitReached };
