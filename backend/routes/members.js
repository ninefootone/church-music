const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, requireMembership, requireAdmin } = require('../middleware/auth');

router.get('/', requireAuth, requireMembership, async function(req, res, next) {
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

router.put('/:membershipId/role', requireAuth, requireAdmin, async function(req, res, next) {
  try {
    const { role } = req.body;
    if (!['admin', 'member', 'revoked'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Prevent removing last admin
    if (role !== 'admin') {
      const adminCount = await pool.query(
        `SELECT COUNT(*) FROM memberships 
         WHERE church_id = $1 AND role = 'admin' AND id != $2`,
        [req.churchId, req.params.membershipId]
      );
      if (parseInt(adminCount.rows[0].count) === 0) {
        return res.status(400).json({ 
          error: 'Cannot remove the last admin. Promote another member to admin first.' 
        });
      }
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

router.delete('/:membershipId', requireAuth, requireAdmin, async function(req, res, next) {
  try {
    // Check not removing last admin
    const membership = await pool.query(
      'SELECT role FROM memberships WHERE id = $1',
      [req.params.membershipId]
    );
    if (membership.rows[0]?.role === 'admin') {
      const adminCount = await pool.query(
        `SELECT COUNT(*) FROM memberships 
         WHERE church_id = $1 AND role = 'admin' AND id != $2`,
        [req.churchId, req.params.membershipId]
      );
      if (parseInt(adminCount.rows[0].count) === 0) {
        return res.status(400).json({ 
          error: 'Cannot remove the last admin.' 
        });
      }
    }
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
