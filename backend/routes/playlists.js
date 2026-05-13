const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, requireMembership, requirePermission } = require('../middleware/auth');

// GET — all members can read
router.get('/', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, name, url, type, sort_order, created_at
       FROM church_playlists
       WHERE church_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [req.churchId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST — admin or can_manage_playlists
router.post('/', requireAuth, requirePermission('can_manage_playlists'), async function(req, res, next) {
  const { name, url, type = 'other' } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name and url are required' });

  try {
    const result = await pool.query(
      `INSERT INTO church_playlists (church_id, name, url, type, sort_order)
       VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM church_playlists WHERE church_id = $1))
       RETURNING *`,
      [req.churchId, name, url, type]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT — admin or can_manage_playlists
router.put('/:id', requireAuth, requirePermission('can_manage_playlists'), async function(req, res, next) {
  const { name, url, type = 'other' } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name and url are required' });

  try {
    const result = await pool.query(
      `UPDATE church_playlists SET name = $1, url = $2, type = $3
       WHERE id = $4 AND church_id = $5
       RETURNING *`,
      [name, url, type, req.params.id, req.churchId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Playlist not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE — admin or can_manage_playlists
router.delete('/:id', requireAuth, requirePermission('can_manage_playlists'), async function(req, res, next) {
  try {
    const result = await pool.query(
      `DELETE FROM church_playlists WHERE id = $1 AND church_id = $2 RETURNING id`,
      [req.params.id, req.churchId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Playlist not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;