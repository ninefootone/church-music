const express = require(‘express’);
const router = express.Router();
const multer = require(‘multer’);
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require(’@aws-sdk/client-s3’);
const { getSignedUrl } = require(’@aws-sdk/s3-request-presigner’);
const pool = require(’../db/pool’);
const { requireAuth, requireAdmin } = require(’../middleware/auth’);
const { v4: uuidv4 } = require(‘uuid’);

const endpoint = process.env.R2_ENDPOINT ||
`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const r2 = new S3Client({
region: ‘auto’,
endpoint: endpoint,
credentials: {
accessKeyId: process.env.R2_ACCESS_KEY_ID || ‘’,
secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ‘’,
},
});

const BUCKET = process.env.R2_BUCKET_NAME;

// Temporary debug log — remove after confirming R2 works
console.log(‘R2 config check:’, {
endpoint: endpoint,
accountId: process.env.R2_ACCOUNT_ID ? ‘SET’ : ‘MISSING’,
accessKeyId: process.env.R2_ACCESS_KEY_ID ? ‘SET’ : ‘MISSING’,
secretKey: process.env.R2_SECRET_ACCESS_KEY ? ‘SET’ : ‘MISSING’,
bucket: process.env.R2_BUCKET_NAME ? ‘SET’ : ‘MISSING’,
});

const upload = multer({
storage: multer.memoryStorage(),
limits: { fileSize: 20 * 1024 * 1024 },
fileFilter: (req, file, cb) => {
const allowed = [‘application/pdf’, ‘image/png’, ‘image/jpeg’];
if (allowed.includes(file.mimetype)) cb(null, true);
else cb(new Error(‘Only PDF and image files are allowed’));
},
});

// POST /uploads/songs/:songId
router.post(’/songs/:songId’, requireAuth, requireAdmin, upload.single(‘file’), async (req, res, next) => {
try {
const { songId } = req.params;
const { file_type, label, key_of } = req.body;
const { churchId } = req;

```
if (!req.file) return res.status(400).json({ error: 'No file provided' });

const ext = req.file.originalname.split('.').pop();
const r2Key = `churches/${churchId}/songs/${songId}/${uuidv4()}.${ext}`;

await r2.send(new PutObjectCommand({
  Bucket: BUCKET,
  Key: r2Key,
  Body: req.file.buffer,
  ContentType: req.file.mimetype,
}));

const result = await pool.query(
  `INSERT INTO song_files (song_id, file_type, label, key_of, r2_key)
   VALUES ($1,$2,$3,$4,$5) RETURNING *`,
  [songId, file_type, label, key_of || null, r2Key]
);

res.status(201).json(result.rows[0]);
```

} catch (err) {
next(err);
}
});

// GET /uploads/songs/:songId/files/:fileId/url
router.get(’/songs/:songId/files/:fileId/url’, requireAuth, requireAdmin, async (req, res, next) => {
try {
const file = await pool.query(
‘SELECT * FROM song_files WHERE id = $1 AND song_id = $2’,
[req.params.fileId, req.params.songId]
);
if (file.rows.length === 0) return res.status(404).json({ error: ‘File not found’ });

```
const url = await getSignedUrl(
  r2,
  new GetObjectCommand({ Bucket: BUCKET, Key: file.rows[0].r2_key }),
  { expiresIn: 3600 }
);

res.json({ url });
```

} catch (err) {
next(err);
}
});

// DELETE /uploads/songs/:songId/files/:fileId
router.delete(’/songs/:songId/files/:fileId’, requireAuth, requireAdmin, async (req, res, next) => {
try {
const file = await pool.query(
‘SELECT * FROM song_files WHERE id = $1 AND song_id = $2’,
[req.params.fileId, req.params.songId]
);
if (file.rows.length === 0) return res.status(404).json({ error: ‘File not found’ });

```
await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: file.rows[0].r2_key }));
await pool.query('DELETE FROM song_files WHERE id = $1', [req.params.fileId]);

res.json({ success: true });
```

} catch (err) {
next(err);
}
});

module.exports = router;