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

// GET /templates/library — searchable public library (in_library = true, is_draft = false)
router.get('/library', requireAuth, async (req, res, next) => {
  try {
    const { q, category, tag, page = '1' } = req.query;
    const limit = 20;
    const offset = (parseInt(page) - 1) * limit;

    // tags param accepts comma-separated tag UUIDs: ?tags=<uuid>,<uuid> (AND logic).
    // Keep only well-formed UUIDs so a malformed param can't cause a uuid-cast error.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const tagIds = req.query.tags
      ? req.query.tags.split(',').map(s => s.trim()).filter(s => UUID_RE.test(s))
      : [];

    let query = `
      SELECT s.id, s.title, s.author, s.default_key, s.category,
             s.first_line, s.ccli_number, s.copyright_info, s.share_all_data,
             ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
      FROM songs s
      LEFT JOIN song_tags st ON st.song_id = s.id
      LEFT JOIN tags t ON t.id = st.tag_id
      WHERE s.church_id = $1
        AND s.in_library = true
        AND (s.is_draft = false OR s.is_draft IS NULL)
        AND (s.retired = false OR s.retired IS NULL)
    `;
    const params = [process.env.MASTER_CHURCH_ID];
    let idx = 2;

    if (q && q.trim()) {
      // tsvector full-text search — same approach as songs route.
      // Short strings (1-2 chars) fall back to title ILIKE prefix match.
      const trimmed = q.trim();
      if (trimmed.length <= 2) {
        query += ` AND s.title ILIKE $${idx}`;
        params.push(`${trimmed}%`);
        idx++;
      } else {
        query += ` AND (s.search_vector @@ plainto_tsquery('english', $${idx}) OR s.tag_search_vector @@ plainto_tsquery('english', $${idx}) OR s.title ILIKE $${idx + 1})`;
        params.push(trimmed, `%${trimmed}%`);
        idx += 2;
      }
    }

    if (category) {
      query += ` AND s.category = $${idx++}`;
      params.push(category);
    }

    if (tag) {
      query += ` AND s.tag_search_vector @@ plainto_tsquery('english', $${idx++})`;
      params.push(tag);
    }
    for (const tagId of tagIds) {
      query += ` AND EXISTS (SELECT 1 FROM song_tags WHERE song_id = s.id AND tag_id = $${idx++})`;
      params.push(tagId);
    }

    query += ` GROUP BY s.id ORDER BY s.title ASC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT s.id)
      FROM songs s
      LEFT JOIN song_tags st ON st.song_id = s.id
      LEFT JOIN tags t ON t.id = st.tag_id
      WHERE s.church_id = $1
        AND s.in_library = true
        AND (s.is_draft = false OR s.is_draft IS NULL)
        AND (s.retired = false OR s.retired IS NULL)
    `;
    const countParams = [process.env.MASTER_CHURCH_ID];
    let cidx = 2;

    if (q && q.trim()) {
      const trimmed = q.trim();
      if (trimmed.length <= 2) {
        countQuery += ` AND s.title ILIKE $${cidx}`;
        countParams.push(`${trimmed}%`);
        cidx++;
      } else {
        countQuery += ` AND (s.search_vector @@ plainto_tsquery('english', $${cidx}) OR s.tag_search_vector @@ plainto_tsquery('english', $${cidx}) OR s.title ILIKE $${cidx + 1})`;
        countParams.push(trimmed, `%${trimmed}%`);
        cidx += 2;
      }
    }
    if (category) {
      countQuery += ` AND s.category = $${cidx++}`;
      countParams.push(category);
    }
    if (tag) {
      countQuery += ` AND s.tag_search_vector @@ plainto_tsquery('english', $${cidx++})`;
      countParams.push(tag);
    }
    for (const tagId of tagIds) {
      countQuery += ` AND EXISTS (SELECT 1 FROM song_tags WHERE song_id = s.id AND tag_id = $${cidx++})`;
      countParams.push(tagId);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      songs: result.rows,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// GET /templates/library/tags — tags that appear on at least one library song.
// Powers the Discover → Song library tag filter; only returns tags that will
// actually yield results, so no chip is ever a dead end.
router.get('/library/tags', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT t.id, t.name
         FROM tags t
         JOIN song_tags st ON st.tag_id = t.id
         JOIN songs s ON s.id = st.song_id
        WHERE s.church_id = $1
          AND s.in_library = true
          AND (s.is_draft = false OR s.is_draft IS NULL)
          AND (s.retired = false OR s.retired IS NULL)
        ORDER BY t.name ASC`,
      [process.env.MASTER_CHURCH_ID]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /templates/:id/detail — full detail for a single library/discover song
router.get('/:id/detail', requireAuth, async (req, res, next) => {
  try {
    const masterChurchId = process.env.MASTER_CHURCH_ID;
    const song = await pool.query(
      `SELECT s.id, s.title, s.author, s.default_key, s.category,
              s.first_line, s.ccli_number, s.copyright_info, s.share_all_data,
              s.notes, s.bible_references, s.suggested_arrangement,
              s.lyrics,
              s.discover_description, s.discover_image_key,
              COALESCE(JSON_AGG(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
       FROM songs s
       LEFT JOIN song_tags st ON st.song_id = s.id
       LEFT JOIN tags t ON t.id = st.tag_id
       WHERE s.id = $1
         AND s.church_id = $2
         AND (s.in_discover = true OR s.in_library = true)
         AND (s.is_draft = false OR s.is_draft IS NULL)
       GROUP BY s.id`,
      [req.params.id, masterChurchId]
    );

    if (song.rows.length === 0) return res.status(404).json({ error: 'Song not found' });

    const row = song.rows[0];

    if (row.discover_image_key) {
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      row.discover_image_url = await getSignedUrl(
        r2,
        new GetObjectCommand({ Bucket: BUCKET, Key: row.discover_image_key }),
        { expiresIn: 3600 }
      );
    }
    delete row.discover_image_key;

    if (!row.share_all_data) {
      row.lyrics = null;
    }

    res.json(row);
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

    // Get template — either a shared template or a discover song from the master library
    const template = await pool.query(
      `SELECT * FROM songs WHERE id = $1 AND (
        (is_template = true AND template_status = 'approved')
        OR
        (church_id = $2 AND in_discover = true)
        OR
        (church_id = $2 AND in_library = true AND (is_draft = false OR is_draft IS NULL))
      )`,
      [req.params.id, process.env.MASTER_CHURCH_ID]
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
        suggested_arrangement, time_signature, tempo,
        notes, bible_references, lyrics, copyright_info, copyright_link, is_template)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,false) RETURNING *`,
      [
        churchId, t.title, t.author, t.default_key, t.category, t.first_line, t.ccli_number,
        t.suggested_arrangement ?? null,
        t.time_signature ?? null,
        t.tempo ?? null,
        t.share_all_data ? t.notes : null,
        t.share_all_data ? t.bible_references : null,
        t.share_all_data ? t.lyrics : null,
        t.copyright_info ?? null,
        t.copyright_link ?? null,
      ]
    );

    // Copy tags. Reuse an existing shared (global) or own-church tag by name —
    // preferring the shared default — and only create a church-owned tag when no
    // match exists. Mirrors the dedupe in POST /songs/tags/church so an import
    // never mints a private duplicate of a default-list tag.
    const templateTags = await pool.query(
      `SELECT t.name FROM song_tags st JOIN tags t ON t.id = st.tag_id WHERE st.song_id = $1`,
      [req.params.id]
    );
    for (const tag of templateTags.rows) {
      const existingTag = await pool.query(
        `SELECT id FROM tags
          WHERE (church_id IS NULL OR church_id = $1)
            AND lower(name) = lower($2)
          ORDER BY (church_id IS NOT NULL)
          LIMIT 1`,
        [churchId, tag.name]
      );
      let tagId;
      if (existingTag.rows.length) {
        tagId = existingTag.rows[0].id;
      } else {
        const newTag = await pool.query(
          `INSERT INTO tags (church_id, name) VALUES ($1, $2)
           ON CONFLICT (church_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [churchId, tag.name]
        );
        tagId = newTag.rows[0].id;
      }
      await pool.query(
        'INSERT INTO song_tags (song_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [song.rows[0].id, tagId]
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
