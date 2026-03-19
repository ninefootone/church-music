const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const generateInviteCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const generateShortId = () => Math.random().toString(36).substring(2, 6);

// Create a church
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Church name required' });

    // Append short random ID to slug to avoid collisions
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const slug = `${baseSlug}-${generateShortId()}`
    const invite_code = generateInviteCode();

    const church = await pool.query(
      'INSERT INTO churches (name, slug, invite_code, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, slug, invite_code, req.user.id]
    );

    await pool.query(
      'INSERT INTO memberships (church_id, user_id, role) VALUES ($1, $2, $3)',
      [church.rows[0].id, req.user.id, 'admin']
    );

    res.status(201).json(church.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Join a church by invite code
router.post('/join', requireAuth, async (req, res, next) => {
  try {
    const { invite_code } = req.body;
    const church = await pool.query('SELECT * FROM churches WHERE invite_code = $1', [invite_code]);
    if (church.rows.length === 0) return res.status(404).json({ error: 'Invalid invite code — please check and try again' });

    const existing = await pool.query(
      'SELECT * FROM memberships WHERE church_id = $1 AND user_id = $2',
      [church.rows[0].id, req.user.id]
    );
    if (existing.rows.length > 0) return res.status(400).json({ error: 'You are already a member of this church' });

    await pool.query(
      'INSERT INTO memberships (church_id, user_id, role) VALUES ($1, $2, $3)',
      [church.rows[0].id, req.user.id, 'member']
    );

    res.json(church.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Get my churches
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const churches = await pool.query(
      `SELECT c.*, m.role FROM churches c
       JOIN memberships m ON m.church_id = c.id
       WHERE m.user_id = $1 AND m.role != 'revoked'
       ORDER BY c.name`,
      [req.user.id]
    );
    res.json(churches.rows);
  } catch (err) {
    next(err);
  }
});

// Get church details
router.get('/:churchId', requireAuth, async (req, res, next) => {
  try {
    const church = await pool.query('SELECT * FROM churches WHERE id = $1', [req.params.churchId]);
    if (church.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(church.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Regenerate invite code (admin only)
router.post('/:churchId/regenerate-invite', requireAuth, async (req, res, next) => {
  try {
    const invite_code = generateInviteCode();
    const church = await pool.query(
      'UPDATE churches SET invite_code = $1 WHERE id = $2 RETURNING *',
      [invite_code, req.params.churchId]
    );
    res.json(church.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
