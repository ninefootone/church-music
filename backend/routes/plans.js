const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, requireMembership, requireAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.get('/', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const churchId = req.churchId;
    const upcoming = req.query.upcoming;

    let query = `
      SELECT s.*,
        COUNT(si.id) FILTER (WHERE si.type = 'song') AS song_count
      FROM plans s
      LEFT JOIN plan_items si ON si.plan_id = s.id
      WHERE s.church_id = $1
    `;
    const params = [churchId];

    if (upcoming === 'true') query += ' AND s.plan_date >= CURRENT_DATE';
    if (upcoming === 'false') query += ' AND s.plan_date < CURRENT_DATE';

    query += ' GROUP BY s.id ORDER BY s.plan_date ' + (upcoming === 'false' ? 'DESC' : 'ASC') + ', s.plan_sort_order ASC, s.plan_time ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/musicians', async function(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT sm.id, sm.name, sm.role, sm.user_id, sm.created_at
       FROM plan_musicians sm
       WHERE sm.plan_id = $1
       ORDER BY sm.created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const churchId = req.churchId;
    const plan = await pool.query(
      'SELECT * FROM plans WHERE id = $1 AND church_id = $2',
      [req.params.id, churchId]
    );
    if (plan.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });

    const items = await pool.query(
      `SELECT si.id, si.type, si.title, si.notes, si.key_override, si.position,
        si.custom_arrangement,
        s.id AS song_id, s.title AS song_title, s.author AS song_author,
        s.default_key AS song_default_key, s.category AS song_category,
        s.ccli_number AS song_ccli_number,
        s.suggested_arrangement AS song_suggested_arrangement
       FROM plan_items si
       LEFT JOIN songs s ON s.id = si.song_id
       WHERE si.plan_id = $1
       ORDER BY si.position`,
      [req.params.id]
    );

    res.json(Object.assign({}, plan.rows[0], { items: items.rows }));
  } catch (err) {
    next(err);
  }
});

router.get('/public/:token', async function(req, res, next) {
  try {
    const plan = await pool.query(
      'SELECT * FROM plans WHERE public_token = $1',
      [req.params.token]
    );
    if (plan.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const items = await pool.query(
      `SELECT si.type, si.title, si.notes, si.key_override, si.position,
        si.custom_arrangement,
        s.id AS song_id, s.title AS song_title, s.author AS song_author,
        s.default_key AS song_default_key, s.youtube_url AS song_youtube_url,
        s.ccli_number AS song_ccli_number,
        s.suggested_arrangement AS song_suggested_arrangement
       FROM plan_items si
       LEFT JOIN songs s ON s.id = si.song_id
       WHERE si.plan_id = $1
       ORDER BY si.position`,
      [plan.rows[0].id]
    );

    res.json(Object.assign({}, plan.rows[0], { items: items.rows }));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const churchId = req.churchId;
    const plan_date = req.body.plan_date;
    const plan_time = req.body.plan_time;
    const plan_sort_order = req.body.plan_sort_order ?? 0;
    const title = req.body.title;
    const public_token = uuidv4().split('-')[0];

    const plan = await pool.query(
      'INSERT INTO plans (church_id, plan_date, plan_time, plan_sort_order, title, public_token, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [churchId, plan_date, plan_time, plan_sort_order, title, public_token, req.user.clerk_id]
    );
    res.status(201).json(plan.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const existing = await pool.query(
      'SELECT created_by FROM plans WHERE id=$1 AND church_id=$2',
      [req.params.id, req.churchId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const isAdmin = req.membership.role === 'admin';
    const isOwner = existing.rows[0].created_by === req.user.clerk_id;
    if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Not authorised' });
    const plan_date = req.body.plan_date;
    const plan_time = req.body.plan_time;
    const plan_sort_order = req.body.plan_sort_order ?? 0;
    const title = req.body.title;
    const plan = await pool.query(
      'UPDATE plans SET plan_date=$1, plan_time=$2, plan_sort_order=$3, title=$4 WHERE id=$5 AND church_id=$6 RETURNING *',
      [plan_date, plan_time, plan_sort_order, title, req.params.id, req.churchId]
    );
    if (plan.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(plan.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/items', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const items = req.body.items;
    const planId = req.params.id;

    await pool.query('DELETE FROM plan_items WHERE plan_id = $1', [planId]);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await pool.query(
        'INSERT INTO plan_items (plan_id, type, song_id, title, notes, key_override, position, custom_arrangement) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [planId, item.type, item.song_id || null, item.title || null, item.notes || null, item.key_override || null, i, item.custom_arrangement || null]
      );
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/musicians', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const { name, role, user_id } = req.body;
    console.log('[musicians POST] body:', req.body, 'planId:', req.params.id);
    if (!name || !role) return res.status(400).json({ error: 'name and role are required' });
    const result = await pool.query(
      `INSERT INTO plan_musicians (plan_id, user_id, name, role)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, user_id || null, name, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[musicians POST] error:', err.message, err.stack);
    next(err);
  }
});

router.delete('/:id/musicians/:musicianId', requireAuth, requireMembership, async function(req, res, next) {
  try {
    await pool.query(
      `DELETE FROM plan_musicians WHERE id = $1 AND plan_id = $2`,
      [req.params.musicianId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const existing = await pool.query(
      'SELECT created_by FROM plans WHERE id=$1 AND church_id=$2',
      [req.params.id, req.churchId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const isAdmin = req.membership.role === 'admin';
    const isOwner = existing.rows[0].created_by === req.user.clerk_id;
    if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Not authorised' });
    await pool.query('DELETE FROM plans WHERE id = $1 AND church_id = $2', [req.params.id, req.churchId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
