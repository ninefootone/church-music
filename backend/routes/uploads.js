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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  },
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

router.get('/songs/:songId/files/:fileId/url', requireAuth, requireAdmin, async function(req, res, next) {
  try {
    const file = await pool.query(
      'SELECT * FROM song_files WHERE id = $1 AND song_id = $2',
      [req.params.fileId, req.params.songId]
    );
    if (file.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const url = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: BUCKET, Key: file.rows[0].r2_key }),
      { expiresIn: 3600 }
    );

    res.json({ url: url });
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
      const url = await getSignedUrl(
        r2,
        new GetObjectCommand({ Bucket: BUCKET, Key: file.r2_key }),
        { expiresIn: 3600 }
      );
      return Object.assign({}, file, { url: url });
    }));

    res.json(filesWithUrls);
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
