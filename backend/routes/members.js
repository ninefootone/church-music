const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, requireMembership, requireAdmin } = require('../middleware/auth');

// GET /members — list church members
router.get('/', requireAuth, requireMembership, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.role, m.joined_at, u.id AS user_id, u.name, u.email
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.church_id = $1 AND m.role != 'revoked'
       ORDER BY m.role DESC, u.name`,
      [req.churchId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// PUT /members/:membershipId/role — change role (admin)
router.put('/:membershipId/role', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['admin', 'member', 'revoked'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const result = await pool.query(
      `UPDATE memberships SET role = $1 WHERE id = $2 AND church_id = $3 RETURNING *`,
      [role, req.params.membershipId, req.churchId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Membership not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /members/:membershipId — remove member (admin)
router.delete('/:membershipId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE memberships SET role = 'revoked' WHERE id = $1 AND church_id = $2`,
      [req.params.membershipId, req.churchId]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
