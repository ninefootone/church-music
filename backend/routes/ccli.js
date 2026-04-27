const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// GET /api/ccli?q=search+term
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const { rows } = await pool.query(`
      SELECT ccli_number, title, author, first_line, default_key
      FROM ccli_lookup
      WHERE title ILIKE $1
      ORDER BY confirmed_count DESC, title ASC
      LIMIT 6
    `, [`%${q}%`]);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;