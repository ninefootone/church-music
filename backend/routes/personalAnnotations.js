// routes/personalAnnotations.js — PERSONAL markings synced to the account (iPad/Mac app). Table:
// migrations/2026-11-27-personal-annotations.sql. Design: claude/personal-markings-2026-11.md.
//
// Every row belongs to one user and only that user ever reads or writes it. Not church-scoped through x-church-id:
// one person's ink covers files in every church they belong to, so each write checks membership of the church that
// owns the file/song instead. Guests are not included (their ink stays on the device).
//
// Sync model:
//   GET  ?since=<seq>  → everything of mine changed after seq (adds AND soft deletes), oldest first, in pages.
//   POST { add, remove } → upsert / soft-delete. Idempotent: re-sending an add is a no-op; re-adding a deleted id
//        (undo of an erase) brings it back; removing a missing or already-deleted id is a no-op.
// A per-user advisory lock serialises one user's writes, so seq order = commit order and a `since` pull never skips
// a row that committed late.
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { cleanStroke } = require('./annotations');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CHANGES = 500;  // per POST (add + remove) — the app sends a big first upload in chunks
const MAX_POINTS = 5000;  // per stroke
const PAGE_SIZE = 500;    // rows per GET

const num = (v) => typeof v === 'number' && Number.isFinite(v);

// ChordPro / lyrics marks (app: chordMarks.ts ChordMark minus id). Values are kept EXACTLY as sent (no rounding or
// clamping) so a mark comes back identical on the other device; anything malformed is rejected, not repaired.
function cleanChordMark(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.pts)) return null;
  if (!Number.isInteger(s.b) || s.b < 0) return null;
  if (s.pts.length === 0 || s.pts.length > MAX_POINTS) return null;
  for (const p of s.pts) if (!Array.isArray(p) || p.length < 2 || !num(p[0]) || !num(p[1])) return null;
  if (typeof s.color !== 'string' || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s.color)) return null;
  if (!num(s.width) || s.width <= 0 || s.width > 100) return null;
  if (s.cap !== 'round' && s.cap !== 'square') return null;
  if (s.join !== 'round' && s.join !== 'bevel') return null;
  const at = s.at;
  if (!at || typeof at !== 'object') return null;
  if (typeof at.key !== 'string' || at.key.length > 20) return null;
  if (!Number.isInteger(at.capo) || !num(at.s) || !Number.isInteger(at.cols)) return null;
  if (typeof at.sig !== 'string' || at.sig.length > 40) return null;
  return {
    b: s.b, pts: s.pts.map((p) => [p[0], p[1]]), color: s.color, width: s.width, cap: s.cap, join: s.join,
    at: { key: at.key, capo: at.capo, s: at.s, cols: at.cols, sig: at.sig },
  };
}

// One add → a row to insert, or null if invalid. Exactly one target: song_file_id (PDF / ChordPro file) or song_id
// (lyrics). Lyrics are always kind 'chordpro'; PDF strokes need a page.
function cleanAdd(a) {
  if (!a || typeof a !== 'object' || typeof a.id !== 'string' || !UUID_RE.test(a.id)) return null;
  const fileId = typeof a.song_file_id === 'string' && UUID_RE.test(a.song_file_id) ? a.song_file_id : null;
  const songId = typeof a.song_id === 'string' && UUID_RE.test(a.song_id) ? a.song_id : null;
  if (!!fileId === !!songId) return null;
  if (a.kind === 'pdf') {
    if (!fileId) return null;
    const page = Number(a.page);
    if (!Number.isInteger(page) || page < 0) return null;
    const stroke = cleanStroke(a.stroke); // same whitelist as shared markings (keeps pw)
    return stroke ? { id: a.id, fileId, songId: null, kind: 'pdf', page, stroke } : null;
  }
  if (a.kind === 'chordpro') {
    const stroke = cleanChordMark(a.stroke);
    return stroke ? { id: a.id, fileId, songId, kind: 'chordpro', page: null, stroke } : null;
  }
  return null;
}

// GET /api/personal-annotations?since=<seq>
// → { changes: [{ id, kind, song_file_id, song_id, page, stroke, deleted }], seq, more }
// `seq` is the cursor for the next call (unchanged if nothing new). `more: true` → call again straight away.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const since = /^\d{1,18}$/.test(String(req.query.since ?? '')) ? String(req.query.since) : '0';
    const r = await pool.query(
      `SELECT id, kind, song_file_id, song_id, page, stroke, deleted_at IS NOT NULL AS deleted, seq
         FROM personal_annotations
        WHERE user_id = $1 AND seq > $2
        ORDER BY seq
        LIMIT $3`,
      [req.user.id, since, PAGE_SIZE + 1]
    );
    const more = r.rows.length > PAGE_SIZE;
    const rows = more ? r.rows.slice(0, PAGE_SIZE) : r.rows;
    const changes = rows.map((x) => (x.deleted
      ? { id: x.id, kind: x.kind, song_file_id: x.song_file_id, song_id: x.song_id, deleted: true }
      : { id: x.id, kind: x.kind, song_file_id: x.song_file_id, song_id: x.song_id, page: x.page, stroke: x.stroke, deleted: false }));
    res.json({ changes, seq: rows.length ? String(rows[rows.length - 1].seq) : since, more });
  } catch (err) { next(err); }
});

// POST /api/personal-annotations  { add: [{ id, kind, song_file_id | song_id, page?, stroke }], remove: [id…] }
// → { accepted: [id…], rejected: [{ id, reason }] }. Rejected adds are dropped by the app (it keeps them locally),
// so one bad stroke or a file the user can no longer see never blocks the rest of the queue.
router.post('/', requireAuth, async (req, res, next) => {
  const add = Array.isArray(req.body?.add) ? req.body.add : [];
  const remove = Array.isArray(req.body?.remove) ? req.body.remove.filter((id) => typeof id === 'string' && UUID_RE.test(id)) : [];
  if (add.length + remove.length > MAX_CHANGES) return res.status(400).json({ error: `Too many changes (max ${MAX_CHANGES})` });

  const accepted = [];
  const rejected = [];
  const rows = [];
  for (const a of add) {
    const row = cleanAdd(a);
    if (row) rows.push(row);
    else rejected.push({ id: typeof a?.id === 'string' ? a.id : null, reason: 'invalid' });
  }

  let client;
  try { client = await pool.connect(); } catch (err) { return next(err); }
  try {
    // Which of the targets is this user a member (not guest) of? One query for all files, one for all songs.
    const fileIds = [...new Set(rows.filter((r) => r.fileId).map((r) => r.fileId))];
    const songIds = [...new Set(rows.filter((r) => r.songId).map((r) => r.songId))];
    const okFiles = new Set();
    const okSongs = new Set();
    if (fileIds.length) {
      const q = await client.query(
        `SELECT sf.id FROM song_files sf JOIN songs s ON s.id = sf.song_id
           JOIN memberships m ON m.church_id = s.church_id AND m.user_id = $2 AND m.role IN ('admin', 'member')
          WHERE sf.id = ANY($1::uuid[])`,
        [fileIds, req.user.id]
      );
      q.rows.forEach((x) => okFiles.add(x.id));
    }
    if (songIds.length) {
      const q = await client.query(
        `SELECT s.id FROM songs s
           JOIN memberships m ON m.church_id = s.church_id AND m.user_id = $2 AND m.role IN ('admin', 'member')
          WHERE s.id = ANY($1::uuid[])`,
        [songIds, req.user.id]
      );
      q.rows.forEach((x) => okSongs.add(x.id));
    }

    await client.query('BEGIN');
    try {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`personal_annotations:${req.user.id}`]);
      for (const r of rows) {
        if (r.fileId ? !okFiles.has(r.fileId) : !okSongs.has(r.songId)) { rejected.push({ id: r.id, reason: 'not found' }); continue; }
        // New id → insert. Known id: only a soft-deleted one changes (undo of an erase brings it back with a new seq);
        // a live one is left alone, so re-sends don't churn seq.
        await client.query(
          `INSERT INTO personal_annotations (user_id, id, song_file_id, song_id, kind, page, stroke)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, id) DO UPDATE
             SET stroke = EXCLUDED.stroke, page = EXCLUDED.page, deleted_at = NULL,
                 seq = nextval('personal_annotations_seq'), updated_at = NOW()
           WHERE personal_annotations.deleted_at IS NOT NULL`,
          [req.user.id, r.id, r.fileId, r.songId, r.kind, r.page, JSON.stringify(r.stroke)]
        );
        accepted.push(r.id);
      }
      if (remove.length) {
        await client.query(
          `UPDATE personal_annotations
              SET deleted_at = NOW(), seq = nextval('personal_annotations_seq'), updated_at = NOW()
            WHERE user_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL`,
          [req.user.id, remove]
        );
        accepted.push(...remove);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    }
    res.json({ accepted, rejected });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
