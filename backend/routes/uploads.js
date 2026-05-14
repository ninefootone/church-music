const express = require('express');
const router = express.Router();
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const pool = require('../db/pool');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const endpoint = process.env.R2_ENDPOINT ||
  ('https://' + process.env.R2_ACCOUNT_ID + '.r2.cloudflarestorage.com');

const r2 = new S3Client({
  region: 'auto',
  endpoint: endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;
module.exports.r2 = r2;
module.exports.BUCKET = BUCKET;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    const allowed = ['application/pdf', 'text/plain', 'application/octet-stream'];
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const allowedExt = ['pdf', 'cho', 'chordpro', 'txt'];
    if (allowed.includes(file.mimetype) && allowedExt.includes(ext || '')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and ChordPro files are allowed'));
    }
  },
});

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const allowedExt = ['jpg', 'jpeg', 'png', 'webp'];
    if (allowedMime.includes(file.mimetype) && allowedExt.includes(ext || '')) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG and WebP images are allowed'));
    }
  },
});

// POST /uploads/songs/:songId/discover-image — upload square artwork for Discover (master library only)
router.post('/songs/:songId/discover-image', requireAuth, requireAdmin, uploadImage.single('image'), async function(req, res, next) {
  try {
    const { songId } = req.params;
    const churchId = req.churchId;

    if (churchId !== process.env.MASTER_CHURCH_ID) {
      return res.status(403).json({ error: 'Only the master library can upload discover images' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const ext = req.file.originalname.split('.').pop()?.toLowerCase();
    const r2Key = 'discover/songs/' + songId + '/artwork.' + ext;

    // Delete old image if one exists
    const existing = await pool.query('SELECT discover_image_key FROM songs WHERE id = $1 AND church_id = $2', [songId, churchId]);
    if (existing.rows[0]?.discover_image_key) {
      try {
        await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: existing.rows[0].discover_image_key }));
      } catch (_) {}
    }

    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: r2Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    await pool.query('UPDATE songs SET discover_image_key = $1 WHERE id = $2 AND church_id = $3', [r2Key, songId, churchId]);

    const url = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: BUCKET, Key: r2Key }),
      { expiresIn: 3600 }
    );

    res.status(201).json({ r2_key: r2Key, url });
  } catch (err) {
    next(err);
  }
});

// DELETE /uploads/songs/:songId/discover-image — remove discover artwork
router.delete('/songs/:songId/discover-image', requireAuth, requireAdmin, async function(req, res, next) {
  try {
    const { songId } = req.params;
    const churchId = req.churchId;

    if (churchId !== process.env.MASTER_CHURCH_ID) {
      return res.status(403).json({ error: 'Only the master library can manage discover images' });
    }

    const existing = await pool.query('SELECT discover_image_key FROM songs WHERE id = $1 AND church_id = $2', [songId, churchId]);
    const key = existing.rows[0]?.discover_image_key;
    if (!key) return res.status(404).json({ error: 'No discover image found' });

    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    await pool.query('UPDATE songs SET discover_image_key = NULL WHERE id = $1 AND church_id = $2', [songId, churchId]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /uploads/songs/:songId/discover-image-url — get signed URL for discover artwork
router.get('/songs/:songId/discover-image-url', requireAuth, async function(req, res, next) {
  try {
    const { songId } = req.params;
    const result = await pool.query('SELECT discover_image_key FROM songs WHERE id = $1', [songId]);
    const key = result.rows[0]?.discover_image_key;
    if (!key) return res.status(404).json({ error: 'No discover image' });

    const url = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn: 3600 }
    );
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

router.post('/songs/:songId', requireAuth, requireAdmin, upload.single('file'), async function(req, res, next) {
  try {
    const songId = req.params.songId;
    const file_type = req.body.file_type;
    const label = req.body.label;
    const key_of = req.body.key_of;
    const churchId = req.churchId;

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const ext = req.file.originalname.split('.').pop();
    const r2Key = 'churches/' + churchId + '/songs/' + songId + '/' + uuidv4() + '.' + ext;

    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: r2Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    const result = await pool.query(
      'INSERT INTO song_files (song_id, file_type, label, key_of, r2_key) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [songId, file_type, label, key_of || null, r2Key]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/songs/:songId/files/:fileId/url', requireAuth, async function(req, res, next) {
  try {
    const file = await pool.query(
      'SELECT * FROM song_files WHERE id = $1 AND song_id = $2',
      [req.params.fileId, req.params.songId]
    );
    if (file.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const activeKey = file.rows[0].edited_r2_key || file.rows[0].r2_key;
    const url = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: BUCKET, Key: activeKey }),
      { expiresIn: 3600 }
    );

    res.json({ url: url, has_edits: !!file.rows[0].edited_r2_key });
  } catch (err) {
    next(err);
  }
});

router.get('/public/songs/:songId/files', async function(req, res, next) {
  try {
    const files = await pool.query(
      'SELECT * FROM song_files WHERE song_id = $1 ORDER BY key_of, file_type',
      [req.params.songId]
    );

    const filesWithUrls = await Promise.all(files.rows.map(async function(file) {
      const activeKey = file.edited_r2_key || file.r2_key;
      const url = await getSignedUrl(
        r2,
        new GetObjectCommand({ Bucket: BUCKET, Key: activeKey }),
        { expiresIn: 3600 }
      );
      return Object.assign({}, file, { url: url, has_edits: !!file.edited_r2_key });
    }));

    res.json(filesWithUrls);
  } catch (err) {
    next(err);
  }
});

router.patch('/songs/:songId/files/:fileId', requireAuth, requireAdmin, async function(req, res, next) {
  try {
    const { file_type, label, key_of } = req.body;
    const result = await pool.query(
      'UPDATE song_files SET file_type = COALESCE($1, file_type), label = COALESCE($2, label), key_of = $3 WHERE id = $4 AND song_id = $5 RETURNING *',
      [file_type, label, key_of || null, req.params.fileId, req.params.songId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/songs/:songId/files/:fileId', requireAuth, requireAdmin, async function(req, res, next) {
  try {
    const file = await pool.query(
      'SELECT * FROM song_files WHERE id = $1 AND song_id = $2',
      [req.params.fileId, req.params.songId]
    );
    if (file.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: file.rows[0].r2_key }));
    await pool.query('DELETE FROM song_files WHERE id = $1', [req.params.fileId]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.r2 = r2;
module.exports.BUCKET = BUCKET;
