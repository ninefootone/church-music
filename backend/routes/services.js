const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, requireMembership, requireAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// GET /services — list services for church
router.get('/', requireAuth, requireMembership, async (req, res, next) => {
  try {
    const { churchId } = req;
    const { upcoming } = req.query;

    let query = `
      SELECT s.*,
        COUNT(si.id) FILTER (WHERE si.type = 'song') AS song_count
      FROM services s
      LEFT JOIN service_items si ON si.service_id = s.id
      WHERE s.church_id = $1
    `;
    const params = [churchId];

    if (upcoming === 'true') query += ` AND s.service_date >= CURRENT_DATE`;
    if (upcoming === 'false') query += ` AND s.service_date < CURRENT_DATE`;

    query += ` GROUP BY s.id ORDER BY s.service_date ${upcoming === 'false' ? 'DESC' : 'ASC'}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /services/:id — service with all items
router.get('/:id', requireAuth, requireMembership, async (req, res, next) => {
  try {
    const { churchId } = req;
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

    res.json({ ...service.rows[0], items: items.rows });
  } catch (err) {
    next(err);
  }
});

// GET /services/public/:token — public read-only view (no auth)
router.get('/public/:token', async (req, res, next) => {
  try {
    const service = await pool.query(
      'SELECT * FROM services WHERE public_token = $1',
      [req.params.token]
    );
    if (service.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const items = await pool.query(
      `SELECT si.type, si.title, si.notes, si.key_override, si.position,
        s.title AS song_title, s.author AS song_author,
        s.default_key AS song_default_key, s.youtube_url AS song_youtube_url,
        s.ccli_number AS song_ccli_number
       FROM service_items si
       LEFT JOIN songs s ON s.id = si.song_id
       WHERE si.service_id = $1
       ORDER BY si.position`,
      [service.rows[0].id]
    );

    res.json({ ...service.rows[0], items: items.rows });
  } catch (err) {
    next(err);
  }
});

// POST /services — create service (admin)
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { churchId } = req;
    const { service_date, service_time, title } = req.body;
    const public_token = uuidv4().split('-')[0]; // short token

    const service = await pool.query(
      `INSERT INTO services (church_id, service_date, service_time, title, public_token)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [churchId, service_date, service_time, title, public_token]
    );
    res.status(201).json(service.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /services/:id — update service details (admin)
router.put('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { service_date, service_time, title } = req.body;
    const service = await pool.query(
      `UPDATE services SET service_date=$1, service_time=$2, title=$3
       WHERE id=$4 AND church_id=$5 RETURNING *`,
      [service_date, service_time, title, req.params.id, req.churchId]
    );
    if (service.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(service.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /services/:id/items — replace all items (admin)
router.put('/:id/items', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { items } = req.body; // array of items in order
    const serviceId = req.params.id;

    await pool.query('DELETE FROM service_items WHERE service_id = $1', [serviceId]);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await pool.query(
        `INSERT INTO service_items (service_id, type, song_id, title, notes, key_override, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [serviceId, item.type, item.song_id || null, item.title || null, item.notes || null, item.key_override || null, i]
      );
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /services/:id (admin)
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM services WHERE id = $1 AND church_id = $2', [req.params.id, req.churchId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
