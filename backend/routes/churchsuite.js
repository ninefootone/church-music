// ChurchSuite sync — questions for admins (item 3, 2026-11-18). See project doc churchsuite-integration.md.
// The sync (scripts/lib/churchsuite-sync.js) writes questions it can't answer to churchsuite_questions; admins
// answer them once here (Settings → ChurchSuite) and the answers are used from the next sync run.
//   person            → member (user_id) / name_only / ignore      → churchsuite_people
//   song              → song (song_id) / ignore                    → churchsuite_songs
//   removed_song      → remove (deletes the plan item now) / keep  (keep = don't ask again for that item)
//   removed_musician  → remove (deletes the plan musician now) / keep
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { isUuid } = require('../utils/ids');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Is the sync set up for this church? (It has run at least once.) Shown as the Settings tab only then.
router.get('/status', requireAuth, requireAdmin, async function(req, res, next) {
  try {
    const r = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM churchsuite_shadow_reports WHERE church_id = $1)
           OR EXISTS (SELECT 1 FROM churchsuite_questions WHERE church_id = $1) AS enabled,
              (SELECT COUNT(*)::int FROM churchsuite_questions WHERE church_id = $1 AND status = 'open') AS open`,
      [req.churchId]);
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

// Open questions (soonest first) + the answers remembered so far.
router.get('/questions', requireAuth, requireAdmin, async function(req, res, next) {
  try {
    const questions = (await pool.query(
      `SELECT q.id, q.kind, q.q_key, q.plan_id, to_char(q.plan_date, 'YYYY-MM-DD') AS plan_date, q.payload,
              p.title AS plan_title
         FROM churchsuite_questions q LEFT JOIN plans p ON p.id = q.plan_id
        WHERE q.church_id = $1 AND q.status = 'open'
        ORDER BY q.plan_date NULLS LAST, q.kind, q.first_seen`, [req.churchId])).rows;
    const people = (await pool.query(
      `SELECT cp.cs_key, cp.cs_name, cp.decision, u.name AS member_name, cp.decided_at
         FROM churchsuite_people cp LEFT JOIN users u ON u.id = cp.user_id
        WHERE cp.church_id = $1 ORDER BY cp.cs_name`, [req.churchId])).rows;
    const songs = (await pool.query(
      `SELECT cs.cs_key, cs.cs_title, cs.decision, s.title AS song_title, cs.decided_at
         FROM churchsuite_songs cs LEFT JOIN songs s ON s.id = cs.song_id
        WHERE cs.church_id = $1 ORDER BY cs.cs_title`, [req.churchId])).rows;
    res.json({ questions, people, songs });
  } catch (err) { next(err); }
});

router.post('/questions/:id/answer', requireAuth, requireAdmin, async function(req, res, next) {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Question not found' });
  const { action, user_id, song_id } = req.body || {};
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const q = (await client.query(
      `SELECT * FROM churchsuite_questions WHERE id = $1 AND church_id = $2 FOR UPDATE`, [req.params.id, req.churchId])).rows[0];
    if (!q) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Question not found' }); }
    if (q.status !== 'open') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This question has already been answered or no longer applies.' }); }
    const fail = async (msg) => { await client.query('ROLLBACK'); return res.status(400).json({ error: msg }); };

    if (q.kind === 'person') {
      if (!['member', 'name_only', 'ignore'].includes(action)) return fail('Choose a member, name only, or never add.');
      let uid = null;
      if (action === 'member') {
        if (!isUuid(user_id)) return fail('Choose a member.');
        const m = await client.query(
          "SELECT 1 FROM memberships WHERE church_id = $1 AND user_id = $2 AND role <> 'revoked'", [req.churchId, user_id]);
        if (!m.rows.length) return fail('That person isn\'t a member of this church.');
        uid = user_id;
      }
      await client.query(
        `INSERT INTO churchsuite_people (church_id, cs_key, cs_name, decision, user_id, decided_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (church_id, cs_key) DO UPDATE
           SET cs_name = EXCLUDED.cs_name, decision = EXCLUDED.decision, user_id = EXCLUDED.user_id,
               decided_by = EXCLUDED.decided_by, decided_at = now()`,
        [req.churchId, q.q_key, q.payload.name || 'Unknown', action, uid, req.user.id]);
    } else if (q.kind === 'song') {
      if (!['song', 'ignore'].includes(action)) return fail('Choose a song, or ignore it.');
      let sid = null;
      if (action === 'song') {
        if (!isUuid(song_id)) return fail('Choose a song.');
        const s = await client.query('SELECT 1 FROM songs WHERE id = $1 AND church_id = $2', [song_id, req.churchId]);
        if (!s.rows.length) return fail('That song isn\'t in this church\'s library.');
        sid = song_id;
      }
      await client.query(
        `INSERT INTO churchsuite_songs (church_id, cs_key, cs_title, decision, song_id, decided_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (church_id, cs_key) DO UPDATE
           SET cs_title = EXCLUDED.cs_title, decision = EXCLUDED.decision, song_id = EXCLUDED.song_id,
               decided_by = EXCLUDED.decided_by, decided_at = now()`,
        [req.churchId, q.q_key, q.payload.title || 'Unknown', action, sid, req.user.id]);
    } else {
      if (!['remove', 'keep'].includes(action)) return fail('Choose remove or keep.');
      if (action === 'remove') {
        // Removing is the admin's own edit, made now (like removing it in the plan builder) — not a sync change.
        if (q.kind === 'removed_song') {
          await client.query('SELECT id FROM plans WHERE id = $1 FOR UPDATE', [q.plan_id]);
          await client.query(
            `DELETE FROM plan_items pi USING plans p
              WHERE pi.id = $1 AND pi.plan_id = p.id AND p.id = $2 AND p.church_id = $3`,
            [q.payload.item_id, q.plan_id, req.churchId]);
        } else {
          await client.query(
            `DELETE FROM plan_musicians pm USING plans p
              WHERE pm.id = $1 AND pm.plan_id = p.id AND p.id = $2 AND p.church_id = $3`,
            [q.payload.musician_id, q.plan_id, req.churchId]);
        }
      }
    }
    await client.query(
      `UPDATE churchsuite_questions SET status = 'answered', answer = $2, answered_by = $3, answered_at = now() WHERE id = $1`,
      [q.id, action, req.user.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    if (client) client.release();
  }
});

// Forget a remembered answer — the sync will ask again next time the person / song comes up.
router.post('/forget', requireAuth, requireAdmin, async function(req, res, next) {
  const { type, cs_key } = req.body || {};
  if (!['person', 'song'].includes(type) || typeof cs_key !== 'string' || !cs_key) return res.status(400).json({ error: 'Bad request' });
  try {
    await pool.query(
      `DELETE FROM ${type === 'person' ? 'churchsuite_people' : 'churchsuite_songs'} WHERE church_id = $1 AND cs_key = $2`,
      [req.churchId, cs_key]);
    // The sync asks again (re-opening the old question) the next time this person / song comes up.
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
