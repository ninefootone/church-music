const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, requireMembership } = require('../middleware/auth');

// GET /stats?period=30|90|365
router.get('/', requireAuth, requireMembership, async (req, res, next) => {
  try {
    const { churchId } = req;
    const period = parseInt(req.query.period) || 365;

    // Top songs in period
    const topSongs = await pool.query(
      `SELECT s.id, s.title, s.author, s.category, s.default_key,
        COUNT(si.id) AS times_sung,
        MAX(srv.plan_date) AS last_sung
       FROM plan_items si
       JOIN plans srv ON srv.id = si.plan_id
       JOIN songs s ON s.id = si.song_id
       WHERE srv.church_id = $1
         AND si.type = 'song'
         AND srv.plan_date >= NOW() - INTERVAL '1 day' * $2
         AND srv.plan_date <= NOW()
       GROUP BY s.id
       ORDER BY times_sung DESC
       LIMIT 20`,
      [churchId, period]
    );

    // Total plans in period
    const totalPlans = await pool.query(
      `SELECT COUNT(*) FROM plans
       WHERE church_id = $1
         AND plan_date >= NOW() - INTERVAL '1 day' * $2
         AND plan_date <= NOW()`,
      [churchId, period]
    );

    // Total songs in library
    const totalSongs = await pool.query(
      'SELECT COUNT(*) FROM songs WHERE church_id = $1',
      [churchId]
    );

    res.json({
      top_songs: topSongs.rows,
      total_plans: parseInt(totalPlans.rows[0].count),
      total_songs: parseInt(totalSongs.rows[0].count),
      period_days: period,
    });
  } catch (err) {
    next(err);
  }
});

// GET /stats/ccli-export?period=365 — CCLI reporting CSV data
router.get('/ccli-export', requireAuth, requireMembership, async (req, res, next) => {
  try {
    const { churchId } = req;
    const period = parseInt(req.query.period) || 365;

    const result = await pool.query(
      `SELECT s.ccli_number, s.title, s.author,
        COUNT(si.id) AS times_used,
        MAX(srv.plan_date) AS last_used
       FROM plan_items si
       JOIN plans srv ON srv.id = si.plan_id
       JOIN songs s ON s.id = si.song_id
       WHERE srv.church_id = $1
         AND si.type = 'song'
         AND s.ccli_number IS NOT NULL
         AND srv.plan_date >= NOW() - INTERVAL '1 day' * $2
         AND srv.plan_date <= NOW()
       GROUP BY s.id
       ORDER BY s.title`,
      [churchId, period]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
