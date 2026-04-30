const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, requireMembership } = require('../middleware/auth');

// GET /api/ccli?q=search+term
router.get('/', requireAuth, requireMembership, async (req, res, next) => {
  try {
    const { q } = req.query;
    const { churchId } = req;
    if (!q || q.length < 2) return res.json([]);

    // Songs from curator churches
    const { rows: curatorRows } = await pool.query(`
      SELECT
        cl.ccli_number,
        cl.title,
        cl.author,
        cl.first_line,
        cl.default_key,
        cl.category,
        EXISTS (
          SELECT 1 FROM songs s
          WHERE s.church_id = $2
            AND s.ccli_number = cl.ccli_number
        ) AS in_library
      FROM ccli_lookup cl
      INNER JOIN churches c ON c.id = cl.source_church_id
      WHERE cl.title ILIKE $1
        AND c.is_curator = TRUE
      ORDER BY cl.confirmed_count DESC, cl.title ASC
      LIMIT 6
    `, [`%${q}%`, churchId]);

    // Songs in the user's own library not already in curator results
    const curatorCcliNumbers = curatorRows.map(r => r.ccli_number);
    const { rows: libraryRows } = await pool.query(`
      SELECT
        ccli_number,
        title,
        author,
        first_line,
        default_key,
        category,
        TRUE AS in_library
      FROM songs
      WHERE church_id = $1
        AND title ILIKE $2
        AND (ccli_number IS NULL OR ccli_number != ALL($3))
      ORDER BY title ASC
      LIMIT 6
    `, [churchId, `%${q}%`, curatorCcliNumbers]);

    // Merge, curator results first
    const combined = [...curatorRows, ...libraryRows].slice(0, 6);

    res.json(combined);
  } catch (err) {
    next(err);
  }
});

module.exports = router;