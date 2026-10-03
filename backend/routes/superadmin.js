const express = require('express');
const router = express.Router();
const { requireIdParams } = require('../utils/ids');
// Malformed IDs in the URL → 404 before any handler runs (see utils/ids.js).
requireIdParams(router, { id: 'Church not found' });
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const endpoint = process.env.R2_ENDPOINT ||
  ('https://' + process.env.R2_ACCOUNT_ID + '.r2.cloudflarestorage.com');

const r2 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;

const SUPER_ADMIN_CLERK_ID = process.env.SUPER_ADMIN_CLERK_ID;

const requireSuperAdmin = (req, res, next) => {
  if (!SUPER_ADMIN_CLERK_ID) {
    return res.status(500).json({ error: 'Super admin not configured' });
  }
  if (req.clerkUserId !== SUPER_ADMIN_CLERK_ID) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// GET /api/superadmin/churches
router.get('/churches', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.created_at,
        u.email AS owner_email,
        u.name AS owner_name,
        (SELECT COUNT(*) FROM songs WHERE church_id = c.id) AS song_count,
        (SELECT COUNT(*) FROM plans WHERE church_id = c.id) AS plan_count,
        (SELECT COUNT(*) FROM memberships WHERE church_id = c.id AND role != 'revoked') AS member_count,
        (SELECT MAX(plan_date) FROM plans WHERE church_id = c.id) AS last_plan_date,
        c.free_access
      FROM churches c
      LEFT JOIN users u ON u.id = c.created_by
      ORDER BY c.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/superadmin/churches/:id
// Database first, in one transaction; R2 files only AFTER the commit. (It used to
// delete the files first, then fail on the plan_items → songs foreign key, leaving
// the church in place with its files gone.) Plans are deleted before the church
// for the same FK reason as utils/accountDeletion.js.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.delete('/churches/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Church not found' });
  if (id === process.env.MASTER_CHURCH_ID) {
    return res.status(400).json({ error: 'The master library church cannot be deleted here' });
  }

  // Connect inside a try: a database outage must reach next(err) (→ 500), not escape as an
  // unhandled rejection that leaves the request hanging.
  let client;
  try { client = await pool.connect(); } catch (err) { return next(err); }
  let churchName, r2Keys;
  try {
    await client.query('BEGIN');

    const churchResult = await client.query('SELECT id, name, logo_url FROM churches WHERE id = $1 FOR UPDATE', [id]);
    if (churchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Church not found' });
    }
    churchName = churchResult.rows[0].name;

    // Collect every R2 key now (originals + edited ChordPro copies + logo); delete after commit.
    const filesResult = await client.query(
      `SELECT sf.r2_key, sf.edited_r2_key
         FROM song_files sf JOIN songs s ON s.id = sf.song_id
        WHERE s.church_id = $1`,
      [id]
    );
    r2Keys = filesResult.rows.flatMap(r => [r.r2_key, r.edited_r2_key]).filter(Boolean);
    const logoUrl = churchResult.rows[0].logo_url;
    const publicBase = process.env.R2_PUBLIC_URL ? process.env.R2_PUBLIC_URL + '/' : null;
    if (logoUrl && publicBase && logoUrl.startsWith(publicBase)) r2Keys.push(logoUrl.slice(publicBase.length));

    await client.query('DELETE FROM plans WHERE church_id = $1', [id]);
    // Cascades to songs, song_files, song_tags, song_videos, memberships, church_roles, …
    await client.query('DELETE FROM churches WHERE id = $1', [id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23503') {
      // Something outside this church still points at it (e.g. another church's plan
      // uses one of its songs). Nothing was deleted, files included.
      return res.status(409).json({ error: `Can't delete: still referenced (${err.constraint}). Nothing was deleted.` });
    }
    return next(err);
  } finally {
    client.release();
  }

  // Outside-world cleanup — the database is already clean.
  const r2Results = await Promise.allSettled(
    r2Keys.map(key => r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })))
  );
  const r2Failures = r2Results
    .map((r, i) => (r.status === 'rejected' ? r2Keys[i] : null))
    .filter(Boolean);
  if (r2Failures.length > 0) {
    console.warn(`[superadmin] R2 delete failures for church ${id}:`, r2Failures);
  }

  res.json({
    success: true,
    churchName,
    filesDeleted: r2Keys.length - r2Failures.length,
    r2Failures,
  });
});

// PATCH /api/superadmin/churches/:id/free-access
router.patch('/churches/:id/free-access', requireAuth, requireSuperAdmin, async (req, res, next) => {
  const { id } = req.params;
  const { free_access } = req.body;

  if (typeof free_access !== 'boolean') {
    return res.status(400).json({ error: 'free_access must be a boolean' });
  }

  try {
    const result = await pool.query(
      'UPDATE churches SET free_access = $1 WHERE id = $2 RETURNING id, name, free_access',
      [free_access, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Church not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;