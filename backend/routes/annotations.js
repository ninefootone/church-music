// routes/annotations.js — shared PDF markings (the iPad app's "Shared" layer). See migrations/add_shared_annotations.js.
// Read: any church member. Write: church admins + members with can_annotate_plans.
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, requireMembership } = require('../middleware/auth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILES = 200;          // per GET
const MAX_STROKES = 500;        // per POST (add + remove)
const MAX_POINTS = 5000;        // per stroke

const canShare = (m) => m && (m.role === 'admin' || !!m.can_annotate_plans);

// Keep only the fields the app draws with, and reject junk (this is stored and sent to every member).
function cleanStroke(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.pts)) return null;
  if (s.pts.length === 0 || s.pts.length > MAX_POINTS) return null;
  const pts = [];
  for (const p of s.pts) {
    if (!Array.isArray(p) || p.length < 2) return null;
    const x = Number(p[0]), y = Number(p[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    pts.push([Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000]);
  }
  const color = typeof s.color === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s.color) ? s.color : '#e23b3b';
  const width = Math.min(Math.max(Number(s.width) || 3, 1), 40);
  const cap = s.cap === 'square' ? 'square' : 'round';
  const join = s.join === 'bevel' ? 'bevel' : 'round';
  return { color, width, cap, join, pts };
}

// Rows for the given file ids, restricted to files that belong to this church.
async function strokesFor(fileIds, churchId) {
  if (!fileIds.length) return {};
  const r = await pool.query(
    `SELECT a.id, a.song_file_id, a.page, a.stroke, a.created_at, u.name AS created_by_name
       FROM shared_annotations a
       JOIN song_files sf ON sf.id = a.song_file_id
       JOIN songs s ON s.id = sf.song_id
       LEFT JOIN users u ON u.id = a.created_by
      WHERE a.song_file_id = ANY($1::uuid[]) AND s.church_id = $2
      ORDER BY a.created_at, a.id`,
    [fileIds, churchId]
  );
  const out = Object.fromEntries(fileIds.map((id) => [id, []]));
  for (const row of r.rows) {
    out[row.song_file_id].push({ id: row.id, page: row.page, stroke: row.stroke, created_at: row.created_at, created_by_name: row.created_by_name });
  }
  return out;
}

// GET /api/annotations/files?ids=<uuid>,<uuid>… → { files: { [fileId]: [stroke…] }, canShare }
router.get('/files', requireAuth, requireMembership, async (req, res, next) => {
  try {
    const ids = String(req.query.ids || '').split(',').map((s) => s.trim()).filter((s) => UUID_RE.test(s));
    if (ids.length > MAX_FILES) return res.status(400).json({ error: `Too many files (max ${MAX_FILES})` });
    res.json({ files: await strokesFor([...new Set(ids)], req.churchId), canShare: canShare(req.membership) });
  } catch (err) { next(err); }
});

// POST /api/annotations/files/:fileId/strokes  { add: [{ id, page, stroke }], remove: [id…] }
// Idempotent: re-sending an add with the same id is ignored; removing a missing id is a no-op.
// Returns the file's full current list so the app can reconcile.
router.post('/files/:fileId/strokes', requireAuth, requireMembership, async (req, res, next) => {
  const { fileId } = req.params;
  if (!UUID_RE.test(fileId)) return res.status(400).json({ error: 'Invalid file id' });
  if (!canShare(req.membership)) return res.status(403).json({ error: 'You don’t have permission to share markings' });

  const add = Array.isArray(req.body?.add) ? req.body.add : [];
  const remove = Array.isArray(req.body?.remove) ? req.body.remove.filter((id) => typeof id === 'string' && UUID_RE.test(id)) : [];
  if (add.length + remove.length > MAX_STROKES) return res.status(400).json({ error: `Too many changes (max ${MAX_STROKES})` });

  const client = await pool.connect();
  let released = false;
  const release = () => { if (!released) { released = true; client.release(); } };
  try {
    const own = await client.query(
      `SELECT 1 FROM song_files sf JOIN songs s ON s.id = sf.song_id WHERE sf.id = $1 AND s.church_id = $2`,
      [fileId, req.churchId]
    );
    if (!own.rows.length) return res.status(404).json({ error: 'File not found' });

    await client.query('BEGIN');
    try {
      for (const a of add) {
        const stroke = cleanStroke(a?.stroke);
        const page = Number(a?.page);
        if (!a || typeof a.id !== 'string' || !UUID_RE.test(a.id) || !stroke || !Number.isInteger(page) || page < 0) continue;
        await client.query(
          `INSERT INTO shared_annotations (id, church_id, song_file_id, page, stroke, created_by)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
          [a.id, req.churchId, fileId, page, JSON.stringify(stroke), req.user.id]
        );
      }
      if (remove.length) {
        await client.query(
          `DELETE FROM shared_annotations WHERE song_file_id = $1 AND church_id = $2 AND id = ANY($3::uuid[])`,
          [fileId, req.churchId, remove]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    }
    release();
    const files = await strokesFor([fileId], req.churchId);
    res.json({ strokes: files[fileId] || [] });
  } catch (err) {
    next(err);
  } finally {
    release(); // always return the connection, including the early 404
  }
});

module.exports = router;
