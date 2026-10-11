const express = require('express');
const router = express.Router();
const { requireIdParams, UUID_RE } = require('../utils/ids');
// Malformed IDs in the URL → 404 before any handler runs (see utils/ids.js).
requireIdParams(router, { id: 'Song not found' });
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { toPrefixQuery } = require('../utils/search');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { r2, BUCKET } = require('./uploads');

// Discover-only mode (/browse) — see project doc song-rights-and-discover-only.md.
// Any signed-in user, church or no church (no x-church-id). Browses the master library's public
// songs (in_library or in_discover, not draft, not retired) and keeps per-USER favourites.
//
// The rights line this route must never cross: churchless users are the public, not a church
// team under its own CCLI licence. So lyrics and files are only served for songs whose files the
// library owner has ticked as cleared (songs.files_cleared) — research alone (rights_status) never
// unlocks them. Everything else shows title/author/key/tags/links only.

const PAGE_SIZE = 30;

const PUBLIC_SONG = `
  s.church_id = $1
  AND (s.in_library = true OR s.in_discover = true)
  AND (s.is_draft = false OR s.is_draft IS NULL)
  AND (s.retired = false OR s.retired IS NULL)`;

router.use(requireAuth);

// GET /api/browse/me → is this user already in a church? (decides the upgrade message)
router.get('/me', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.name FROM memberships m JOIN churches c ON c.id = m.church_id WHERE m.user_id = $1 LIMIT 1`,
      [req.user.id]
    );
    res.json({ church_name: rows[0]?.name || null });
  } catch (err) {
    next(err);
  }
});

// GET /api/browse/tags → tags used on at least one public library song
router.get('/tags', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT t.id, t.name
         FROM tags t
         JOIN song_tags st ON st.tag_id = t.id
         JOIN songs s ON s.id = st.song_id
        WHERE t.church_id IS NULL AND ${PUBLIC_SONG}
        ORDER BY t.name`,
      [process.env.MASTER_CHURCH_ID]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/browse/songs?q=&tags=<uuid,uuid>&favourites=1&free=1&page=1
router.get('/songs', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const params = [process.env.MASTER_CHURCH_ID, req.user.id];
    let where = PUBLIC_SONG;

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) {
      if (q.length <= 2) {
        params.push(`${q}%`);
        where += ` AND s.title ILIKE $${params.length}`;
      } else {
        params.push(toPrefixQuery(q), `%${q}%`);
        where += ` AND (s.search_vector @@ to_tsquery('simple', $${params.length - 1})
                    OR s.tag_search_vector @@ to_tsquery('simple', $${params.length - 1})
                    OR s.title ILIKE $${params.length})`;
      }
    }
    const tagIds = typeof req.query.tags === 'string'
      ? req.query.tags.split(',').map((t) => t.trim()).filter((t) => UUID_RE.test(t))
      : [];
    for (const tagId of tagIds) {
      params.push(tagId);
      where += ` AND EXISTS (SELECT 1 FROM song_tags x WHERE x.song_id = s.id AND x.tag_id = $${params.length})`;
    }
    if (req.query.favourites === '1') {
      where += ` AND EXISTS (SELECT 1 FROM user_favourite_songs f WHERE f.song_id = s.id AND f.user_id = $2)`;
    }
    if (req.query.free === '1') where += ' AND s.files_cleared = true';

    // $2 (user id) is referenced even when the favourites filter is off — Postgres rejects an unused,
    // untyped parameter ("could not determine data type of parameter $2").
    const count = await pool.query(`SELECT COUNT(*)::int AS n, $2::uuid AS _user FROM songs s WHERE ${where}`, params);
    params.push(PAGE_SIZE, (page - 1) * PAGE_SIZE);
    const { rows } = await pool.query(
      `SELECT s.id, s.title, s.author, s.default_key,
              COALESCE(s.files_cleared, false) AS free,
              EXISTS (SELECT 1 FROM user_favourite_songs f WHERE f.song_id = s.id AND f.user_id = $2) AS is_favourite,
              COALESCE((SELECT array_agg(t.name ORDER BY t.name)
                          FROM song_tags st JOIN tags t ON t.id = st.tag_id AND t.church_id IS NULL
                         WHERE st.song_id = s.id), '{}') AS tags
         FROM songs s
        WHERE ${where}
        ORDER BY lower(s.title)
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ songs: rows, total: count.rows[0].n, page, pages: Math.max(1, Math.ceil(count.rows[0].n / PAGE_SIZE)) });
  } catch (err) {
    next(err);
  }
});

// GET /api/browse/songs/:id → detail. Lyrics + files ONLY when files_cleared.
router.get('/songs/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.title, s.author, s.default_key, s.first_line, s.ccli_number, s.copyright_info,
              s.bible_references, s.lyrics, COALESCE(s.files_cleared, false) AS free,
              EXISTS (SELECT 1 FROM user_favourite_songs f WHERE f.song_id = s.id AND f.user_id = $3) AS is_favourite,
              COALESCE((SELECT array_agg(t.name ORDER BY t.name)
                          FROM song_tags st JOIN tags t ON t.id = st.tag_id AND t.church_id IS NULL
                         WHERE st.song_id = s.id), '{}') AS tags
         FROM songs s
        WHERE s.id = $2 AND ${PUBLIC_SONG}`,
      [process.env.MASTER_CHURCH_ID, req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Song not found' });
    const song = rows[0];

    const videos = await pool.query(
      'SELECT url, label, link_type FROM song_videos WHERE song_id = $1 ORDER BY sort_order',
      [song.id]
    );
    song.videos = videos.rows;

    song.files = [];
    if (song.free) {
      const f = await pool.query(
        'SELECT id, file_type, label, key_of, r2_key, edited_r2_key FROM song_files WHERE song_id = $1 ORDER BY key_of, file_type',
        [song.id]
      );
      song.files = await Promise.all(
        f.rows.map(async (file) => ({
          id: file.id,
          file_type: file.file_type,
          label: file.label,
          key_of: file.key_of,
          url: await getSignedUrl(r2, new GetObjectCommand({ Bucket: BUCKET, Key: file.edited_r2_key || file.r2_key }), {
            expiresIn: 3600,
          }),
        }))
      );
    } else {
      song.lyrics = null;
    }
    res.json(song);
  } catch (err) {
    next(err);
  }
});

// POST / DELETE /api/browse/favourites/:id → add / remove a favourite (per user, idempotent)
router.post('/favourites/:id', async (req, res, next) => {
  try {
    const ok = await pool.query(`SELECT 1 FROM songs s WHERE s.id = $2 AND ${PUBLIC_SONG}`, [
      process.env.MASTER_CHURCH_ID,
      req.params.id,
    ]);
    if (ok.rows.length === 0) return res.status(404).json({ error: 'Song not found' });
    await pool.query(
      'INSERT INTO user_favourite_songs (user_id, song_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, req.params.id]
    );
    res.json({ is_favourite: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/favourites/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM user_favourite_songs WHERE user_id = $1 AND song_id = $2', [
      req.user.id,
      req.params.id,
    ]);
    res.json({ is_favourite: false });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
