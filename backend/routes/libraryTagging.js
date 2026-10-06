const express = require('express');
const router = express.Router();
const { requireIdParams } = require('../utils/ids');
// Malformed IDs in the URL → 404 before any handler runs (see utils/ids.js).
requireIdParams(router, { id: 'Song not found', tagId: 'Tag not found' });
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// Bulk tagging page for the master library (/library-tagging).
// Two kinds of editor:
//  - owner:  an admin of the master library church → tags + draft/live, public library, share all data
//  - tagger: a signed-in user whose email is in LIBRARY_TAGGER_EMAILS (Railway env, comma-separated)
//            → tags only
// Taggers don't need to be members of the master church (a user can only belong to one church
// today), so access is by their Clerk sign-in email, not by membership. No x-church-id needed.
// Only GLOBAL tags can be applied here — the shared vocabulary every church sees.

function taggerEmails() {
  return (process.env.LIBRARY_TAGGER_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

const requireLibraryEditor = async (req, res, next) => {
  try {
    const masterId = process.env.MASTER_CHURCH_ID;
    if (!masterId) return res.status(503).json({ error: 'Library tagging is not configured.' });
    const admin = await pool.query(
      "SELECT 1 FROM memberships WHERE church_id = $1 AND user_id = $2 AND role = 'admin'",
      [masterId, req.user.id]
    );
    if (admin.rows.length > 0) {
      req.libraryRole = 'owner';
      return next();
    }
    const email = (req.user.email || '').toLowerCase();
    if (email && taggerEmails().includes(email)) {
      req.libraryRole = 'tagger';
      return next();
    }
    return res.status(403).json({ error: "You don't have access to library tagging." });
  } catch (err) {
    next(err);
  }
};

const requireOwner = (req, res, next) => {
  if (req.libraryRole !== 'owner') return res.status(403).json({ error: 'Only the library owner can change this.' });
  next();
};

router.use(requireAuth, requireLibraryEditor);

// Global tag ids currently on one song — returned after every tag change so the page
// picks up anything another helper changed on the same song in the meantime.
async function songTagIds(songId) {
  const { rows } = await pool.query(
    `SELECT st.tag_id::text AS id
       FROM song_tags st JOIN tags t ON t.id = st.tag_id AND t.church_id IS NULL
      WHERE st.song_id = $1`,
    [songId]
  );
  return rows.map((r) => r.id);
}

async function masterSongExists(songId) {
  const { rows } = await pool.query('SELECT 1 FROM songs WHERE id = $1 AND church_id = $2', [
    songId,
    process.env.MASTER_CHURCH_ID,
  ]);
  return rows.length > 0;
}

// GET /api/library-tagging/me → who am I on this page
router.get('/me', (req, res) => {
  res.json({ role: req.libraryRole, email: req.user.email });
});

// GET /api/library-tagging/tags → the global tag vocabulary
router.get('/tags', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id::text AS id, name FROM tags WHERE church_id IS NULL ORDER BY lower(name)'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/library-tagging/songs → every non-retired master library song, one row each.
// Lyrics are NOT included (fetched per song) to keep this list small.
router.get('/songs', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.title, s.author,
              COALESCE(s.is_draft, false)       AS is_draft,
              COALESCE(s.in_library, false)     AS in_library,
              COALESCE(s.share_all_data, false) AS share_all_data,
              (s.lyrics IS NOT NULL AND btrim(s.lyrics) <> '') AS has_lyrics,
              (SELECT COUNT(*)::int FROM song_files f WHERE f.song_id = s.id) AS file_count,
              COALESCE(array_agg(t.id::text) FILTER (WHERE t.id IS NOT NULL), '{}') AS tag_ids
         FROM songs s
         LEFT JOIN song_tags st ON st.song_id = s.id
         LEFT JOIN tags t ON t.id = st.tag_id AND t.church_id IS NULL
        WHERE s.church_id = $1
          AND (s.retired = false OR s.retired IS NULL)
        GROUP BY s.id
        ORDER BY lower(s.title)`,
      [process.env.MASTER_CHURCH_ID]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/library-tagging/songs/:id/lyrics
router.get('/songs/:id/lyrics', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT lyrics FROM songs WHERE id = $1 AND church_id = $2', [
      req.params.id,
      process.env.MASTER_CHURCH_ID,
    ]);
    if (rows.length === 0) return res.status(404).json({ error: 'Song not found' });
    res.json({ lyrics: rows[0].lyrics || '' });
  } catch (err) {
    next(err);
  }
});

// POST /api/library-tagging/songs/:id/tags/:tagId → add one tag.
// One tag at a time (not "replace the whole list") so two helpers working on the same
// song can't wipe each other's tags. The song_tags trigger keeps tag search up to date.
router.post('/songs/:id/tags/:tagId', async (req, res, next) => {
  try {
    if (!(await masterSongExists(req.params.id))) return res.status(404).json({ error: 'Song not found' });
    const tag = await pool.query('SELECT 1 FROM tags WHERE id = $1 AND church_id IS NULL', [req.params.tagId]);
    if (tag.rows.length === 0) return res.status(404).json({ error: 'Tag not found' });
    await pool.query('INSERT INTO song_tags (song_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
      req.params.id,
      req.params.tagId,
    ]);
    res.json({ tag_ids: await songTagIds(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/library-tagging/songs/:id/tags/:tagId → remove one tag
router.delete('/songs/:id/tags/:tagId', async (req, res, next) => {
  try {
    if (!(await masterSongExists(req.params.id))) return res.status(404).json({ error: 'Song not found' });
    await pool.query('DELETE FROM song_tags WHERE song_id = $1 AND tag_id = $2', [
      req.params.id,
      req.params.tagId,
    ]);
    res.json({ tag_ids: await songTagIds(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/library-tagging/songs/:id/flags → owner only.
// Body: any of { is_draft, in_library, share_all_data } as true/false.
// share_all_data also sets is_template/template_status, exactly as PUT /api/songs/:id does.
router.patch('/songs/:id/flags', requireOwner, async (req, res, next) => {
  try {
    const body = req.body || {};
    const sets = [];
    const params = [];
    const set = (col, val) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    for (const f of ['is_draft', 'in_library', 'share_all_data']) {
      if (f in body && typeof body[f] !== 'boolean') {
        return res.status(400).json({ error: `${f} must be true or false` });
      }
    }
    if ('is_draft' in body) set('is_draft', body.is_draft);
    if ('in_library' in body) set('in_library', body.in_library);
    if ('share_all_data' in body) {
      set('share_all_data', body.share_all_data);
      set('is_template', body.share_all_data);
      set('template_status', body.share_all_data ? 'approved' : 'pending');
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to change' });

    params.push(req.params.id, process.env.MASTER_CHURCH_ID);
    const { rows } = await pool.query(
      `UPDATE songs SET ${sets.join(', ')}
        WHERE id = $${params.length - 1} AND church_id = $${params.length}
        RETURNING id, COALESCE(is_draft, false) AS is_draft, COALESCE(in_library, false) AS in_library,
                  COALESCE(share_all_data, false) AS share_all_data`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Song not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
