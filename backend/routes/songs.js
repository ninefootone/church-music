const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, requireMembership, requireAdmin } = require('../middleware/auth');

// GET /songs — list church songs
router.get('/', requireAuth, requireMembership, async (req, res, next) => {
  try {
    const { churchId } = req;
    const { category, search } = req.query;

    let query = `
      SELECT s.*,
        ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) AS tags,
        COUNT(DISTINCT ss.id) FILTER (WHERE srv.service_date <= NOW()) AS times_sung,
        COUNT(DISTINCT ss.id) FILTER (WHERE srv.service_date > NOW()) AS times_planned,
        MAX(srv.service_date) FILTER (WHERE srv.service_date <= NOW()) AS last_sung,
        MIN(srv.service_date) FILTER (WHERE srv.service_date > NOW()) AS next_planned
      FROM songs s
      LEFT JOIN song_tags st ON st.song_id = s.id
      LEFT JOIN tags t ON t.id = st.tag_id
      LEFT JOIN service_items ss ON ss.song_id = s.id
      LEFT JOIN services srv ON srv.id = ss.service_id AND srv.church_id = $1
      WHERE s.church_id = $1
    `;
    const params = [churchId];
    let idx = 2;

    if (category) {
      query += ` AND s.category = $${idx++}`;
      params.push(category);
    }
    if (search) {
      query += ` AND (s.title ILIKE $${idx} OR s.author ILIKE $${idx} OR s.lyrics ILIKE $${idx} OR s.first_line ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ` GROUP BY s.id ORDER BY s.title`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /songs/:id — single song with files
router.get('/:id', requireAuth, requireMembership, async (req, res, next) => {
  try {
    const { churchId } = req;
    const song = await pool.query(
      `SELECT s.*,
        ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
       FROM songs s
       LEFT JOIN song_tags st ON st.song_id = s.id
       LEFT JOIN tags t ON t.id = st.tag_id
       WHERE s.id = $1 AND s.church_id = $2
       GROUP BY s.id`,
      [req.params.id, churchId]
    );
    if (song.rows.length === 0) return res.status(404).json({ error: 'Song not found' });

    const files = await pool.query(
      'SELECT * FROM song_files WHERE song_id = $1 ORDER BY key_of, file_type',
      [req.params.id]
    );

    const videos = await pool.query(
      'SELECT * FROM song_videos WHERE song_id = $1 ORDER BY sort_order',
      [req.params.id]
    );

    // Usage stats
    const usage = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE srv.service_date <= NOW()) AS times_sung,
        COUNT(*) FILTER (WHERE srv.service_date > NOW()) AS times_planned,
        MAX(srv.service_date) FILTER (WHERE srv.service_date <= NOW()) AS last_sung,
        MIN(srv.service_date) FILTER (WHERE srv.service_date > NOW()) AS next_planned
       FROM service_items si
       JOIN services srv ON srv.id = si.service_id
       WHERE si.song_id = $1 AND srv.church_id = $2`,
      [req.params.id, churchId]
    );

    // Recent services
    const recentServices = await pool.query(
      `SELECT srv.id, srv.service_date, srv.service_time, si.key_override
       FROM service_items si
       JOIN services srv ON srv.id = si.service_id
       WHERE si.song_id = $1 AND srv.church_id = $2 AND srv.service_date <= NOW()
       ORDER BY srv.service_date DESC LIMIT 10`,
      [req.params.id, churchId]
    );

    res.json({
      ...song.rows[0],
      files: files.rows,
      videos: videos.rows,
      usage: usage.rows[0],
      recent_services: recentServices.rows,
    });
  } catch (err) {
    next(err);
  }
});

// POST /songs — create song (admin)
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { churchId } = req;
    const { title, author, default_key, category, first_line, lyrics, ccli_number, youtube_url, notes, bible_references, suggested_arrangement, ccli_url, tags } = req.body;

    const song = await pool.query(
      `INSERT INTO songs (church_id, title, author, default_key, category, first_line, lyrics, ccli_number, youtube_url, notes, bible_references, suggested_arrangement, ccli_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [churchId, title, author, default_key, category, first_line, lyrics, ccli_number, youtube_url, notes, bible_references, suggested_arrangement, ccli_url]
    );

    // Handle tags
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        const trimmed = tagName.trim();
        if (!trimmed) continue;
        const tag = await pool.query(
          `INSERT INTO tags (church_id, name) VALUES ($1, $2)
           ON CONFLICT (church_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [churchId, trimmed]
        );
        await pool.query(
          'INSERT INTO song_tags (song_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [song.rows[0].id, tag.rows[0].id]
        );
      }
    }

    res.status(201).json(song.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /songs/:id — update song (admin)
router.put('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { churchId } = req;
    const { title, author, default_key, category, first_line, lyrics, ccli_number, youtube_url, notes, bible_references, suggested_arrangement, ccli_url, tags } = req.body;

    const song = await pool.query(
      `UPDATE songs SET title=$1, author=$2, default_key=$3, category=$4,
       first_line=$5, lyrics=$6, ccli_number=$7, youtube_url=$8,
       notes=$9, bible_references=$10, suggested_arrangement=$11, ccli_url=$12
       WHERE id=$13 AND church_id=$14 RETURNING *`,
      [title, author, default_key, category, first_line, lyrics, ccli_number, youtube_url, notes, bible_references, suggested_arrangement, ccli_url, req.params.id, churchId]
    );
    if (song.rows.length === 0) return res.status(404).json({ error: 'Song not found' });

    // Replace tags
    await pool.query('DELETE FROM song_tags WHERE song_id = $1', [req.params.id]);
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        const trimmed = tagName.trim();
        if (!trimmed) continue;
        const tag = await pool.query(
          `INSERT INTO tags (church_id, name) VALUES ($1, $2)
           ON CONFLICT (church_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [churchId, trimmed]
        );
        await pool.query(
          'INSERT INTO song_tags (song_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, tag.rows[0].id]
        );
      }
    }

    res.json(song.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /songs/:id (admin)
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM songs WHERE id = $1 AND church_id = $2', [req.params.id, req.churchId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /songs/:id/videos
router.post('/:id/videos', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { url, label, sort_order } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    const result = await pool.query(
      `INSERT INTO song_videos (song_id, url, label, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, url, label || null, sort_order || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;