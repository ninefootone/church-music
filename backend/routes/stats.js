const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, requireMembership } = require('../middleware/auth');

// GET /stats?period=30|90|365
router.get('/', requireAuth, requireMembership, async (req, res, next) => {
  try {
    const { churchId } = req;
    const period = parseInt(req.query.period) || 365;

    // Top songs in period. A song counts once per SERVICE it's at: a plan's services are its start
    // time + extra_times; a reprise in the same plan isn't a second use; a per-service item (e.g.
    // "9:15 only", plan_items.service_times) counts only for its own services. See
    // multi-service-plans.md + per-service-items.md. The CCLI export below uses the same rule.
    const topSongs = await pool.query(
      `SELECT s.id, s.title, s.author, s.category, s.default_key,
        SUM(u.services)::int AS times_sung,
        MAX(u.plan_date) AS last_sung
       FROM (
         SELECT si.song_id, srv.id AS plan_id, srv.plan_date,
                COUNT(DISTINCT svc.t) AS services
           FROM plan_items si
           JOIN plans srv ON srv.id = si.plan_id
           CROSS JOIN LATERAL unnest(ARRAY[COALESCE(srv.plan_start_time, '00:00'::time)] || srv.extra_times) AS svc(t)
          WHERE srv.church_id = $1
            AND si.type = 'song'
            AND srv.plan_date >= NOW() - INTERVAL '1 day' * $2
            AND srv.plan_date <= NOW()
            AND (cardinality(si.service_times) = 0 OR svc.t = ANY(si.service_times)
                 OR NOT (si.service_times && (ARRAY[srv.plan_start_time] || srv.extra_times)))
          GROUP BY si.song_id, srv.id, srv.plan_date
       ) u
       JOIN songs s ON s.id = u.song_id
       GROUP BY s.id
       ORDER BY times_sung DESC
       LIMIT 20`,
      [churchId, period]
    );

    // Total plans in period (and services: a plan with extra times is several services)
    const totalPlans = await pool.query(
      `SELECT COUNT(*), COALESCE(SUM(1 + cardinality(extra_times)), 0) AS services FROM plans
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
      total_services: parseInt(totalPlans.rows[0].services),
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
        SUM(u.services)::int AS times_used,
        MAX(u.plan_date) AS last_used
       FROM (
         SELECT si.song_id, srv.id AS plan_id, srv.plan_date,
                COUNT(DISTINCT svc.t) AS services
           FROM plan_items si
           JOIN plans srv ON srv.id = si.plan_id
           CROSS JOIN LATERAL unnest(ARRAY[COALESCE(srv.plan_start_time, '00:00'::time)] || srv.extra_times) AS svc(t)
          WHERE srv.church_id = $1
            AND si.type = 'song'
            AND srv.plan_date >= NOW() - INTERVAL '1 day' * $2
            AND srv.plan_date <= NOW()
            AND (cardinality(si.service_times) = 0 OR svc.t = ANY(si.service_times)
                 OR NOT (si.service_times && (ARRAY[srv.plan_start_time] || srv.extra_times)))
          GROUP BY si.song_id, srv.id, srv.plan_date
       ) u
       JOIN songs s ON s.id = u.song_id
       WHERE s.ccli_number IS NOT NULL
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
