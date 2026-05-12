const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, requireMembership, requireAdmin } = require('../middleware/auth');
const { r2, BUCKET } = require('./uploads');
const { CopyObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

// GET /discover — curated songs from master library with in_discover = true
router.get('/discover', requireAuth, async (req, res, next) => {
  try {
    const { r2, BUCKET } = require('./uploads');
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

    const result = await pool.query(
      `SELECT s.id, s.title, s.author, s.default_key, s.category,
              s.first_line, s.ccli_number, s.discover_description,
              s.discover_image_key, s.share_all_data,
              ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
       FROM songs s
       LEFT JOIN song_tags st ON st.song_id = s.id
       LEFT JOIN tags t ON t.id = st.tag_id
       WHERE s.church_id = $1
         AND s.in_discover = true
         AND (s.retired = false OR s.retired IS NULL)
       GROUP BY s.id
       ORDER BY s.discover_sort_order ASC NULLS LAST, s.updated_at DESC`,
      [process.env.MASTER_CHURCH_ID]
    );

    const songs = await Promise.all(result.rows.map(async (song) => {
      if (song.discover_image_key) {
        try {
          song.discover_image_url = await getSignedUrl(
            r2,
            new GetObjectCommand({ Bucket: BUCKET, Key: song.discover_image_key }),
            { expiresIn: 3600 }
          );
        } catch {}
      }
      const videos = await pool.query(
        `SELECT url, label, link_type FROM song_videos WHERE song_id = $1 ORDER BY sort_order`,
        [song.id]
      );
      song.videos = videos.rows;
      return song;
    }));

    res.json(songs);
  } catch (err) {
    next(err);
  }
});

// PUT /templates/discover/order — save drag-and-drop order (master library only)
router.put('/discover/order', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const churchId = req.churchId;
    if (churchId !== process.env.MASTER_CHURCH_ID) {
      return res.status(403).json({ error: 'Only the master library can set discover order' });
    }
    const { order } = req.body; // array of song ids in new order
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });

    await Promise.all(order.map((id, index) =>
      pool.query('UPDATE songs SET discover_sort_order = $1 WHERE id = $2 AND church_id = $3', [index, id, churchId])
    ));

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /templates/search?q= — search global template library
router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const result = await pool.query(
      `SELECT s.id, s.title, s.author, s.default_key, s.category, s.first_line, s.ccli_number,
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

    // Copy template to church — include extended fields if share_all_data is enabled
    const song = await pool.query(
      `INSERT INTO songs (church_id, title, author, default_key, category, first_line, ccli_number,
        notes, bible_references, suggested_arrangement, lyrics, copyright_info, copyright_link, is_template)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false) RETURNING *`,
      [
        churchId, t.title, t.author, t.default_key, t.category, t.first_line, t.ccli_number,
        t.share_all_data ? t.notes : null,
        t.share_all_data ? t.bible_references : null,
        t.share_all_data ? t.suggested_arrangement : null,
        t.share_all_data ? t.lyrics : null,
        t.copyright_info ?? null,
        t.copyright_link ?? null,
      ]
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

    // Copy song files in R2 if share_all_data is enabled
    if (t.share_all_data) {
      const files = await pool.query(
        `SELECT * FROM song_files WHERE song_id = $1`,
        [req.params.id]
      );
      for (const file of files.rows) {
        const ext = file.r2_key.split('.').pop();
        const newKey = `churches/${churchId}/songs/${song.rows[0].id}/${uuidv4()}.${ext}`;
        await r2.send(new CopyObjectCommand({
          Bucket: BUCKET,
          CopySource: `${BUCKET}/${file.r2_key}`,
          Key: newKey,
        }));
        await pool.query(
          `INSERT INTO song_files (song_id, file_type, label, key_of, r2_key) VALUES ($1,$2,$3,$4,$5)`,
          [song.rows[0].id, file.file_type, file.label, file.key_of, newKey]
        );
      }
    }

    // Copy song_videos if share_all_data is enabled
    if (t.share_all_data) {
      const videos = await pool.query(
        `SELECT url, label, link_type, sort_order FROM song_videos WHERE song_id = $1`,
        [req.params.id]
      );
      for (const v of videos.rows) {
        await pool.query(
          `INSERT INTO song_videos (song_id, url, label, link_type, sort_order) VALUES ($1,$2,$3,$4,$5)`,
          [song.rows[0].id, v.url, v.label, v.link_type, v.sort_order]
        );
      }
    }

    res.status(201).json({ ...song.rows[0], share_all_data: t.share_all_data });
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
