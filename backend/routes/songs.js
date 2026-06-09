const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, requireMembership, requireAdmin, requirePermission } = require('../middleware/auth');

// GET /songs/tags/all — all global tags (church_id IS NULL = master-managed)
router.get('/tags/all', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name FROM tags WHERE church_id IS NULL ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /songs/tags — master only, create a global tag
router.post('/tags', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (req.churchId !== process.env.MASTER_CHURCH_ID) {
      return res.status(403).json({ error: 'Only the master library can manage global tags' });
    }
    const { name } = req.body;
    const trimmed = name?.trim();
    if (!trimmed) return res.status(400).json({ error: 'Tag name is required' });
    const result = await pool.query(
      `INSERT INTO tags (church_id, name) VALUES (NULL, $1) RETURNING id, name`,
      [trimmed]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Tag already exists' });
    next(err);
  }
});

// DELETE /songs/tags/:id — master only, delete a global tag
router.delete('/tags/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (req.churchId !== process.env.MASTER_CHURCH_ID) {
      return res.status(403).json({ error: 'Only the master library can manage global tags' });
    }
    await pool.query(`DELETE FROM tags WHERE id = $1 AND church_id IS NULL`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /songs — list church songs
router.get('/', requireAuth, requireMembership, async (req, res, next) => {
  try {
    const { churchId } = req;
    const { category, search } = req.query;
    // tags param accepts comma-separated tag IDs: ?tags=1,2,3
    const tagIds = req.query.tags ? req.query.tags.split(',').map(Number).filter(Boolean) : [];

    let query = `
      SELECT s.*,
        COALESCE(JSON_AGG(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,
        COUNT(DISTINCT ss.id) FILTER (WHERE srv.plan_date <= NOW()) AS times_sung,
        COUNT(DISTINCT ss.id) FILTER (WHERE srv.plan_date > NOW()) AS times_planned,
        MAX(srv.plan_date) FILTER (WHERE srv.plan_date <= NOW()) AS last_sung,
        MIN(srv.plan_date) FILTER (WHERE srv.plan_date > NOW()) AS next_planned
      FROM songs s
      LEFT JOIN song_tags st ON st.song_id = s.id
      LEFT JOIN tags t ON t.id = st.tag_id
      LEFT JOIN plan_items ss ON ss.song_id = s.id
      LEFT JOIN plans srv ON srv.id = ss.plan_id AND srv.church_id = $1
      WHERE s.church_id = $1
    `;
    const params = [churchId];
    let idx = 2;

    if (category) {
      query += ` AND s.category = $${idx++}`;
      params.push(category);
    }
    if (search && search.trim()) {
      // Use tsvector full-text search across song fields and tags.
      // plainto_tsquery handles plain user input safely (no special syntax required).
      // Falls back to ILIKE on title for very short strings (1-2 chars) where tsvector
      // won't produce useful tokens.
      const trimmed = search.trim();
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
    if (tagIds.length > 0) {
      // Each selected tag must be present — AND logic (song must have ALL chosen tags).
      // Swap to ANY/array overlap for OR logic when building the tag filter UI.
      for (const tagId of tagIds) {
        query += ` AND EXISTS (SELECT 1 FROM song_tags WHERE song_id = s.id AND tag_id = $${idx++})`;
        params.push(tagId);
      }
    }

    if (req.query.include_retired !== 'true') {
      query += ` AND (s.retired = FALSE OR s.retired IS NULL)`;
    }
    if (req.query.draft_only === 'true') {
      query += ` AND s.is_draft = TRUE`;
    }

    const sort = req.query.sort || 'title';
    const orderClause = {
      title:      's.title ASC',
      most_sung:  'times_sung DESC, s.title ASC',
      least_sung: 'times_sung ASC, s.title ASC',
      recent:     'last_sung DESC NULLS LAST, s.title ASC',
      oldest:     'last_sung ASC NULLS LAST, s.title ASC',
    }[sort] || 's.title ASC';

    query += ` GROUP BY s.id ORDER BY ${orderClause}`;

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
        COALESCE(JSON_AGG(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
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
        COUNT(*) FILTER (WHERE srv.plan_date < CURRENT_DATE) AS times_sung,
        COUNT(*) FILTER (WHERE srv.plan_date >= CURRENT_DATE) AS times_planned,
        MAX(srv.plan_date) FILTER (WHERE srv.plan_date < CURRENT_DATE) AS last_sung,
        MIN(srv.plan_date) FILTER (WHERE srv.plan_date >= CURRENT_DATE) AS next_planned
       FROM plan_items si
       JOIN plans srv ON srv.id = si.plan_id
       WHERE si.song_id = $1 AND srv.church_id = $2`,
      [req.params.id, churchId]
    );

    // Recent plans
    const recentPlans = await pool.query(
      `SELECT srv.id, srv.plan_date, srv.plan_time, si.key_override
       FROM plan_items si
       JOIN plans srv ON srv.id = si.plan_id
       WHERE si.song_id = $1 AND srv.church_id = $2 AND srv.plan_date <= NOW()
       ORDER BY srv.plan_date DESC LIMIT 10`,
      [req.params.id, churchId]
    );

    res.json({
      ...song.rows[0],
      files: files.rows,
      videos: videos.rows,
      usage: usage.rows[0],
      recent_plans: recentPlans.rows,
    });
  } catch (err) {
    next(err);
  }
});

// POST /songs — create song (admin or can_manage_songs)
router.post('/', requireAuth, requirePermission('can_manage_songs'), async (req, res, next) => {
  try {
    const { churchId } = req;

    // Free tier gate — max 5 songs
    const church = await pool.query('SELECT subscription_status FROM churches WHERE id = $1', [churchId]);
    const status = church.rows[0]?.subscription_status;
    if (!status || status === 'free') {
      const count = await pool.query('SELECT COUNT(*) FROM songs WHERE church_id = $1', [churchId]);
      if (parseInt(count.rows[0].count) >= 5) {
        return res.status(403).json({ error: 'You have reached the 5 song limit on the free plan. Upgrade in Settings to add more.' });
      }
    }

    const { title, author, default_key, category, first_line, lyrics, ccli_number, youtube_url, notes, bible_references, suggested_arrangement, ccli_url, share_all_data, copyright_info, copyright_link, in_discover, discover_description, tags, time_signature, tempo, default_duration } = req.body;

    const isMasterLibrary = churchId === process.env.MASTER_CHURCH_ID;
    const discoverEnabled = isMasterLibrary && (in_discover ?? false);
    const shareEnabled = isMasterLibrary && (share_all_data ?? false);

    const song = await pool.query(
      `INSERT INTO songs (church_id, title, author, default_key, category, first_line, lyrics, ccli_number, youtube_url, notes, bible_references, suggested_arrangement, ccli_url, share_all_data, copyright_info, copyright_link, in_discover, discover_description, time_signature, tempo, default_duration)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
      [churchId, title, author, default_key, category, first_line, lyrics, ccli_number, youtube_url, notes, bible_references, suggested_arrangement, ccli_url, shareEnabled, copyright_info ?? null, copyright_link ?? null, discoverEnabled, discover_description ?? null, time_signature ?? null, tempo ? parseInt(tempo) : null, default_duration ? parseInt(default_duration) : null]
    );

    // Handle tags — only global tags (church_id IS NULL) are permitted
    if (tags && tags.length > 0) {
      for (const tagId of tags) {
        if (!tagId) continue;
        await pool.query(
          'INSERT INTO song_tags (song_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [song.rows[0].id, tagId]
        );
      }
    }

    if (ccli_number) {
      await pool.query(`
        INSERT INTO ccli_lookup (ccli_number, title, author, first_line, default_key, category, source_church_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (ccli_number) DO UPDATE SET
          confirmed_count = ccli_lookup.confirmed_count + 1,
          category = COALESCE(EXCLUDED.category, ccli_lookup.category),
          updated_at = NOW()
      `, [ccli_number, title, author, first_line, default_key, category ?? null, churchId]);
    }

    res.status(201).json(song.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/discover', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const churchId = req.churchId;
    if (churchId !== process.env.MASTER_CHURCH_ID) {
      return res.status(403).json({ error: 'Only the master library can change discover visibility' });
    }
    const { in_discover } = req.body;
    const result = await pool.query(
      'UPDATE songs SET in_discover = $1 WHERE id = $2 AND church_id = $3 RETURNING id, in_discover',
      [!!in_discover, req.params.id, churchId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Song not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /songs/:id/retire — toggle retired flag (admin or can_manage_songs)
router.patch('/:id/retire', requireAuth, requirePermission('can_manage_songs'), async (req, res, next) => {
  try {
    const { churchId } = req;
    const { retired } = req.body;
    const result = await pool.query(
      `UPDATE songs SET retired = $1, updated_at = NOW() WHERE id = $2 AND church_id = $3 RETURNING *`,
      [retired, req.params.id, churchId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Song not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /songs/:id — update song (admin or can_manage_songs)
router.put('/:id', requireAuth, requirePermission('can_manage_songs'), async (req, res, next) => {
  try {
    const { churchId } = req;
    const { title, author, default_key, category, first_line, lyrics, ccli_number, youtube_url, notes, bible_references, suggested_arrangement, ccli_url, share_all_data, copyright_info, copyright_link, in_discover, discover_description, tags, time_signature, tempo, default_duration, is_draft, in_library } = req.body;

    const isMasterLibrary = churchId === process.env.MASTER_CHURCH_ID;
    const shareEnabled = isMasterLibrary && (share_all_data ?? false);
    const discoverEnabled = isMasterLibrary && (in_discover ?? false);
    const libraryEnabled = isMasterLibrary && (in_library ?? false);
    const draftEnabled = isMasterLibrary && (is_draft ?? false);

    const song = await pool.query(
      `UPDATE songs SET title=$1, author=$2, default_key=$3, category=$4,
       first_line=$5, lyrics=$6, ccli_number=$7, youtube_url=$8,
       notes=$9, bible_references=$10, suggested_arrangement=$11, ccli_url=$12,
       share_all_data=$13, copyright_info=$14, copyright_link=$15,
       is_template=$16, template_status=$17,
       in_discover=$18, discover_description=$19,
       time_signature=$20, tempo=$21, default_duration=$22,
       in_library=$23, is_draft=$24
       WHERE id=$25 AND church_id=$26 RETURNING *`,
      [title, author, default_key, category, first_line, lyrics, ccli_number, youtube_url, notes, bible_references, suggested_arrangement, ccli_url, shareEnabled, copyright_info ?? null, copyright_link ?? null, shareEnabled, shareEnabled ? 'approved' : 'pending', discoverEnabled, discover_description ?? null, time_signature ?? null, tempo ? parseInt(tempo) : null, default_duration ? parseInt(default_duration) : null, libraryEnabled, draftEnabled, req.params.id, churchId]
    );
    if (song.rows.length === 0) return res.status(404).json({ error: 'Song not found' });

    // Replace tags — only global tags (church_id IS NULL) are permitted
    await pool.query('DELETE FROM song_tags WHERE song_id = $1', [req.params.id]);
    if (tags && tags.length > 0) {
      for (const tagId of tags) {
        if (!tagId) continue;
        await pool.query(
          'INSERT INTO song_tags (song_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, tagId]
        );
      }
    }

    if (ccli_number) {
      await pool.query(`
        INSERT INTO ccli_lookup (ccli_number, title, author, first_line, default_key, category, source_church_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (ccli_number) DO UPDATE SET
          confirmed_count = ccli_lookup.confirmed_count + 1,
          category = COALESCE(EXCLUDED.category, ccli_lookup.category),
          updated_at = NOW()
      `, [ccli_number, title, author, first_line, default_key, category ?? null, churchId]);
    }

    res.json(song.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /songs/:id (admin or can_manage_songs)
router.delete('/:id', requireAuth, requirePermission('can_manage_songs'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM songs WHERE id = $1 AND church_id = $2', [req.params.id, req.churchId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /songs/:id/videos
router.post('/:id/videos', requireAuth, requirePermission('can_manage_songs'), async (req, res, next) => {
  try {
    const { url, label, sort_order, link_type } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    const result = await pool.query(
      `INSERT INTO song_videos (song_id, url, label, sort_order, link_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, url, label || null, sort_order || 0, link_type || 'youtube']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /songs/:id/videos/:videoId
router.put('/:id/videos/:videoId', requireAuth, requirePermission('can_manage_songs'), async (req, res, next) => {
  try {
    const { url, label, link_type } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    const result = await pool.query(
      `UPDATE song_videos SET url=$1, label=$2, link_type=$3
       WHERE id=$4 AND song_id=$5 RETURNING *`,
      [url, label || null, link_type || 'youtube', req.params.videoId, req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Link not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /songs/:id/videos/:videoId
router.delete('/:id/videos/:videoId', requireAuth, requirePermission('can_manage_songs'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM song_videos WHERE id=$1 AND song_id=$2 RETURNING id`,
      [req.params.videoId, req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Link not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;