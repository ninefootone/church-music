const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const SUPER_ADMIN_CLERK_ID = process.env.SUPER_ADMIN_CLERK_ID;

const requireSuperAdmin = (req, res, next) => {
  if (!SUPER_ADMIN_CLERK_ID) {
    return res.status(500).json({ error: 'Super admin not configured' });
  }
  if (req.clerkUserId !== SUPER_ADMIN_CLERK_ID) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// GET /api/superadmin/churches
router.get('/churches', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.created_at,
        u.email AS owner_email,
        u.name AS owner_name,
        (SELECT COUNT(*) FROM songs WHERE church_id = c.id) AS song_count,
        (SELECT COUNT(*) FROM plans WHERE church_id = c.id) AS plan_count,
        (SELECT COUNT(*) FROM memberships WHERE church_id = c.id AND role != 'revoked') AS member_count,
        (SELECT MAX(plan_date) FROM plans WHERE church_id = c.id) AS last_plan_date
      FROM churches c
      LEFT JOIN users u ON u.id = c.created_by
      ORDER BY c.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;