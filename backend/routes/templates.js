const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, requireMembership, requireAdmin } = require('../middleware/auth');

// GET /templates/search?q= — search global template library
router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const result = await pool.query(
      `SELECT id, title, author, default_key, category, first_line, ccli_number,
        ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
       FROM songs s
       LEFT JOIN song_tags st ON st.song_id = s.id
       LEFT JOIN tags t ON t.id = st.tag_id
       WHERE s.is_template = true
         AND s.template_status = 'approved'
         AND (s.title ILIKE $1 OR s.author ILIKE $1)
       GROUP BY s.id
       ORDER BY s.title
       LIMIT 5`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /templates/:id/import — import a template into church library
router.post('/:id/import', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { churchId } = req;

    // Get template
    const template = await pool.query(
      `SELECT * FROM songs WHERE id = $1 AND is_template = true AND template_status = 'approved'`,
      [req.params.id]
    );
    if (template.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    const t = template.rows[0];

    // Check not already imported
    const existing = await pool.query(
      'SELECT id FROM songs WHERE church_id = $1 AND title ILIKE $2',
      [churchId, t.title]
    );
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Song already in your library', existing: existing.rows[0] });

    // Copy template to church
    const song = await pool.query(
      `INSERT INTO songs (church_id, title, author, default_key, category, first_line, ccli_number, is_template)
       VALUES ($1,$2,$3,$4,$5,$6,$7,false) RETURNING *`,
      [churchId, t.title, t.author, t.default_key, t.category, t.first_line, t.ccli_number]
    );

    // Copy tags
    const templateTags = await pool.query(
      `SELECT t.name FROM song_tags st JOIN tags t ON t.id = st.tag_id WHERE st.song_id = $1`,
      [req.params.id]
    );
    for (const tag of templateTags.rows) {
      const newTag = await pool.query(
        `INSERT INTO tags (church_id, name) VALUES ($1, $2)
         ON CONFLICT (church_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [churchId, tag.name]
      );
      await pool.query(
        'INSERT INTO song_tags (song_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [song.rows[0].id, newTag.rows[0].id]
      );
    }

    res.status(201).json(song.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /templates/contribute — submit a song as a template
router.post('/contribute', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { songId } = req.body;
    const { churchId } = req;

    const song = await pool.query(
      'SELECT * FROM songs WHERE id = $1 AND church_id = $2',
      [songId, churchId]
    );
    if (song.rows.length === 0) return res.status(404).json({ error: 'Song not found' });
    const s = song.rows[0];

    // Create pending template (no files, no lyrics)
    const template = await pool.query(
      `INSERT INTO songs (title, author, default_key, category, first_line, ccli_number, is_template, template_status, contributed_by)
       VALUES ($1,$2,$3,$4,$5,$6,true,'pending',$7) RETURNING *`,
      [s.title, s.author, s.default_key, s.category, s.first_line, s.ccli_number, churchId]
    );

    res.status(201).json({ message: 'Submitted for review', template: template.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
