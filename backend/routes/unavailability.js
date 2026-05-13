const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, requireMembership, requireAdmin } = require('../middleware/auth');

// GET /api/unavailability — current user's unavailability entries
router.get('/', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, start_date, end_date, note, created_at
       FROM member_unavailability
       WHERE church_id = $1 AND user_id = $2
       ORDER BY start_date ASC`,
      [req.churchId, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/unavailability — add an entry
router.post('/', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const { start_date, end_date, note } = req.body;
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }
    if (end_date < start_date) {
      return res.status(400).json({ error: 'end_date must be on or after start_date' });
    }
    const result = await pool.query(
      `INSERT INTO member_unavailability (church_id, user_id, start_date, end_date, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.churchId, req.user.id, start_date, end_date, note || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/unavailability/:id — edit an entry (own entries only)
router.put('/:id', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const { start_date, end_date, note } = req.body;
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }
    if (end_date < start_date) {
      return res.status(400).json({ error: 'end_date must be on or after start_date' });
    }
    const result = await pool.query(
      `UPDATE member_unavailability
       SET start_date = $1, end_date = $2, note = $3
       WHERE id = $4 AND church_id = $5 AND user_id = $6
       RETURNING *`,
      [start_date, end_date, note || null, req.params.id, req.churchId, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/unavailability/:id — delete own entry
router.delete('/:id', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const result = await pool.query(
      `DELETE FROM member_unavailability
       WHERE id = $1 AND church_id = $2 AND user_id = $3
       RETURNING id`,
      [req.params.id, req.churchId, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/unavailability/check?userId=X&date=Y — check a member is available on a plan date (admin only)
router.get('/check', requireAuth, requireAdmin, async function(req, res, next) {
  try {
    const { userId, date } = req.query;
    if (!userId || !date) {
      return res.status(400).json({ error: 'userId and date are required' });
    }
    const result = await pool.query(
      `SELECT id, start_date, end_date, note
       FROM member_unavailability
       WHERE church_id = $1 AND user_id = $2
         AND start_date <= $3 AND end_date >= $3`,
      [req.churchId, userId, date]
    );
    res.json({ unavailable: result.rows.length > 0, entries: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/unavailability/team — all team unavailabilities (admin only)
router.get('/team', requireAuth, requireAdmin, async function(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT mu.id, mu.start_date, mu.end_date, mu.note,
              u.name, u.email, u.image_url
       FROM member_unavailability mu
       JOIN users u ON u.id = mu.user_id
       WHERE mu.church_id = $1
       ORDER BY mu.start_date ASC, u.name ASC`,
      [req.churchId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;