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
      FROM services s
      LEFT JOIN service_items si ON si.service_id = s.id
      WHERE s.church_id = $1
    `;
    const params = [churchId];

    if (upcoming === 'true') query += ' AND s.service_date >= CURRENT_DATE';
    if (upcoming === 'false') query += ' AND s.service_date < CURRENT_DATE';

    query += ' GROUP BY s.id ORDER BY s.service_date ' + (upcoming === 'false' ? 'DESC' : 'ASC') + ', s.service_sort_order ASC, s.service_time ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/musicians', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT sm.id, sm.name, sm.role, sm.user_id, sm.created_at
       FROM service_musicians sm
       WHERE sm.service_id = $1
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
    const service = await pool.query(
      'SELECT * FROM services WHERE id = $1 AND church_id = $2',
      [req.params.id, churchId]
    );
    if (service.rows.length === 0) return res.status(404).json({ error: 'Service not found' });

    const items = await pool.query(
      `SELECT si.*, s.title AS song_title, s.author AS song_author,
        s.default_key AS song_default_key, s.category AS song_category,
        s.ccli_number AS song_ccli_number
       FROM service_items si
       LEFT JOIN songs s ON s.id = si.song_id
       WHERE si.service_id = $1
       ORDER BY si.position`,
      [req.params.id]
    );

    res.json(Object.assign({}, service.rows[0], { items: items.rows }));
  } catch (err) {
    next(err);
  }
});

router.get('/public/:token', async function(req, res, next) {
  try {
    const service = await pool.query(
      'SELECT * FROM services WHERE public_token = $1',
      [req.params.token]
    );
    if (service.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const items = await pool.query(
      `SELECT si.type, si.title, si.notes, si.key_override, si.position,
        s.id AS song_id, s.title AS song_title, s.author AS song_author,
        s.default_key AS song_default_key, s.youtube_url AS song_youtube_url,
        s.ccli_number AS song_ccli_number
       FROM service_items si
       LEFT JOIN songs s ON s.id = si.song_id
       WHERE si.service_id = $1
       ORDER BY si.position`,
      [service.rows[0].id]
    );

    res.json(Object.assign({}, service.rows[0], { items: items.rows }));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const churchId = req.churchId;
    const service_date = req.body.service_date;
    const service_time = req.body.service_time;
    const service_sort_order = req.body.service_sort_order ?? 0;
    const title = req.body.title;
    const public_token = uuidv4().split('-')[0];

    const service = await pool.query(
      'INSERT INTO services (church_id, service_date, service_time, service_sort_order, title, public_token, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [churchId, service_date, service_time, service_sort_order, title, public_token, req.user.clerk_id]
    );
    res.status(201).json(service.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const existing = await pool.query(
      'SELECT created_by FROM services WHERE id=$1 AND church_id=$2',
      [req.params.id, req.churchId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const isAdmin = req.memberRole === 'admin';
    const isOwner = existing.rows[0].created_by === req.user.clerk_id;
    if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Not authorised' });
    const service_date = req.body.service_date;
    const service_time = req.body.service_time;
    const service_sort_order = req.body.service_sort_order ?? 0;
    const title = req.body.title;
    const service = await pool.query(
      'UPDATE services SET service_date=$1, service_time=$2, service_sort_order=$3, title=$4 WHERE id=$5 AND church_id=$6 RETURNING *',
      [service_date, service_time, service_sort_order, title, req.params.id, req.churchId]
    );
    if (service.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(service.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/items', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const items = req.body.items;
    const serviceId = req.params.id;

    await pool.query('DELETE FROM service_items WHERE service_id = $1', [serviceId]);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await pool.query(
        'INSERT INTO service_items (service_id, type, song_id, title, notes, key_override, position) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [serviceId, item.type, item.song_id || null, item.title || null, item.notes || null, item.key_override || null, i]
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
    if (!name || !role) return res.status(400).json({ error: 'name and role are required' });
    const result = await pool.query(
      `INSERT INTO service_musicians (service_id, user_id, name, role)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, user_id || null, name, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/musicians/:musicianId', requireAuth, requireMembership, async function(req, res, next) {
  try {
    await pool.query(
      `DELETE FROM service_musicians WHERE id = $1 AND service_id = $2`,
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
      'SELECT created_by FROM services WHERE id=$1 AND church_id=$2',
      [req.params.id, req.churchId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const isAdmin = req.memberRole === 'admin';
    const isOwner = existing.rows[0].created_by === req.user.clerk_id;
    if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Not authorised' });
    await pool.query('DELETE FROM services WHERE id = $1 AND church_id = $2', [req.params.id, req.churchId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
