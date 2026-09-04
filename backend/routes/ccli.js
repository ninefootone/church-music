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

    // Songs from curator churches. `src` is the actual source song behind the
    // ccli_lookup row (the curator church's song with this CCLI number); we pull
    // its time signature, BPM and suggested arrangement, plus its GLOBAL tags.
    // Only global tags are returned because their ids are portable across churches
    // — a curator's own church-scoped tag id would not validate for the importer.
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
        ) AS in_library,
        src.time_signature,
        src.tempo,
        src.suggested_arrangement,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
             FROM song_tags st
             JOIN tags t ON t.id = st.tag_id
            WHERE st.song_id = src.id
              AND t.church_id IS NULL),
          '[]'::json
        ) AS tags
      FROM ccli_lookup cl
      INNER JOIN churches c ON c.id = cl.source_church_id
      LEFT JOIN LATERAL (
        SELECT s2.id, s2.time_signature, s2.tempo, s2.suggested_arrangement
        FROM songs s2
        WHERE s2.church_id = cl.source_church_id
          AND s2.ccli_number = cl.ccli_number
        ORDER BY s2.updated_at DESC NULLS LAST
        LIMIT 1
      ) src ON TRUE
      WHERE cl.title ILIKE $1
        AND c.is_curator = TRUE
      ORDER BY cl.confirmed_count DESC, cl.title ASC
      LIMIT 6
    `, [`%${q}%`, churchId]);

    // Songs in the user's own library not already in curator results
    const curatorCcliNumbers = curatorRows.map(r => r.ccli_number);
    const { rows: libraryRows } = await pool.query(`
      SELECT
        s.ccli_number,
        s.title,
        s.author,
        s.first_line,
        s.default_key,
        s.category,
        TRUE AS in_library,
        s.time_signature,
        s.tempo,
        s.suggested_arrangement,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
             FROM song_tags st
             JOIN tags t ON t.id = st.tag_id
            WHERE st.song_id = s.id
              AND (t.church_id IS NULL OR t.church_id = $1)),
          '[]'::json
        ) AS tags
      FROM songs s
      WHERE s.church_id = $1
        AND s.title ILIKE $2
        AND (s.ccli_number IS NULL OR s.ccli_number != ALL($3))
      ORDER BY s.title ASC
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