// Guest musicians (memberships.role = 'guest') — what they may see. See claude/guest-mode.md.
// A guest sees a plan only if ALL of these hold:
//   - they're on its musician list (plan_musicians.user_id),
//   - it's published (never drafts),
//   - its date is no more than GUEST_DAYS days ago (future plans always count).
// Songs and files follow from that: a guest sees a song only if it's in a plan they can see.
// Routes that let guests in use requireMemberOrGuest and MUST check these; every other route uses
// requireMembership, which turns guests away.
const pool = require('../db/pool');

const GUEST_DAYS = 7;

const isGuest = (req) => !!req.membership && req.membership.role === 'guest';

// SQL condition: plan `alias` is visible to the guest whose users.id is the bind parameter `userParam` (e.g. '$2').
function guestPlanSql(alias, userParam) {
  return `(${alias}.status = 'published'
    AND ${alias}.plan_date >= CURRENT_DATE - ${GUEST_DAYS}
    AND EXISTS (SELECT 1 FROM plan_musicians gpm WHERE gpm.plan_id = ${alias}.id AND gpm.user_id = ${userParam}))`;
}

async function guestCanSeePlan(req, planId) {
  const r = await pool.query(
    `SELECT 1 FROM plans p WHERE p.id = $1 AND p.church_id = $2 AND ${guestPlanSql('p', '$3')}`,
    [planId, req.churchId, req.user.id]
  );
  return r.rows.length > 0;
}

async function guestCanSeeSong(req, songId) {
  const r = await pool.query(
    `SELECT 1 FROM plan_items pi JOIN plans p ON p.id = pi.plan_id
      WHERE pi.song_id = $1 AND p.church_id = $2 AND ${guestPlanSql('p', '$3')}
      LIMIT 1`,
    [songId, req.churchId, req.user.id]
  );
  return r.rows.length > 0;
}

// The subset of fileIds (song_files.id) that belong to songs in plans the guest can see.
async function guestVisibleFileIds(req, fileIds) {
  if (!fileIds.length) return [];
  const r = await pool.query(
    `SELECT DISTINCT sf.id FROM song_files sf
       JOIN plan_items pi ON pi.song_id = sf.song_id
       JOIN plans p ON p.id = pi.plan_id
      WHERE sf.id = ANY($1::uuid[]) AND p.church_id = $2 AND ${guestPlanSql('p', '$3')}`,
    [fileIds, req.churchId, req.user.id]
  );
  return r.rows.map((row) => row.id);
}

module.exports = { GUEST_DAYS, isGuest, guestPlanSql, guestCanSeePlan, guestCanSeeSong, guestVisibleFileIds };
