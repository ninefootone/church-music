const express = require('express');
const router = express.Router();
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
        (SELECT MAX(plan_date) FROM plans WHERE church_id = c.id) AS last_plan_date
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
router.delete('/churches/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
  const { id } = req.params;

  try {
    // 1. Confirm church exists
    const churchResult = await pool.query('SELECT id, name FROM churches WHERE id = $1', [id]);
    if (churchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Church not found' });
    }

    // 2. Collect all R2 keys for files belonging to this church's songs
    const filesResult = await pool.query(
      `SELECT sf.r2_key
       FROM song_files sf
       JOIN songs s ON s.id = sf.song_id
       WHERE s.church_id = $1`,
      [id]
    );

    // 3. Delete R2 files (fire-and-forget per file; log failures but don't abort)
    const r2Keys = filesResult.rows.map(r => r.r2_key);

    const r2Results = await Promise.allSettled(
      r2Keys.map(key =>
        r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
      )
    );

    const r2Failures = r2Results
      .map((r, i) => r.status === 'rejected' ? r2Keys[i] : null)
      .filter(Boolean);

    if (r2Failures.length > 0) {
      console.warn(`[superadmin] R2 delete failures for church ${id}:`, r2Failures);
    }

    // 5. Delete church from DB — cascades to songs, song_files, song_tags,
    //    song_videos, plans, plan_items, plan_musicians, memberships, church_roles
    await pool.query('DELETE FROM churches WHERE id = $1', [id]);

    res.json({
      success: true,
      churchName: churchResult.rows[0].name,
      filesDeleted: r2Keys.length - r2Failures.length,
      r2Failures,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;