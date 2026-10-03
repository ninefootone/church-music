const express = require('express');
const router = express.Router();
const { requireIdParams } = require('../utils/ids');
// Malformed IDs in the URL → 404 before any handler runs (see utils/ids.js).
requireIdParams(router, { songId: 'Song not found', fileId: 'File not found' });
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const pool = require('../db/pool');
const { requireAuth, requireAdmin, requireMembership, requirePermission } = require('../middleware/auth');
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

// Check the file's actual CONTENT matches its extension. The browser sets the
// file type from the name, so a PNG renamed to .pdf used to upload fine and only
// fail when someone tried to open it.
function contentMatchesExtension(buffer, ext) {
  if (!buffer || buffer.length === 0) return false;
  const head = buffer.subarray(0, 16);
  switch (ext) {
    case 'pdf': {
      // "%PDF-" usually at byte 0; the spec allows it within the first 1 KB.
      return buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'));
    }
    case 'cho': case 'chordpro': case 'txt': {
      // Plain text: no NUL bytes in the first 8 KB (images/PDFs/Word files have them).
      return !buffer.subarray(0, 8192).includes(0);
    }
    case 'png':  return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'jpg': case 'jpeg': return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    case 'webp': return head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP';
    default: return false;
  }
}
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
      cb(Object.assign(new Error('Only PDF and ChordPro files are allowed'), { status: 400, expose: true }));
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
      cb(Object.assign(new Error('Only JPEG, PNG and WebP images are allowed'), { status: 400, expose: true }));
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
    if (!contentMatchesExtension(req.file.buffer, ext)) {
      return res.status(400).json({ error: "This image doesn't match its file type — it may have been renamed." });
    }
    const r2Key = 'discover/songs/' + songId + '/artwork.' + ext;

    // Song must exist in the master library BEFORE anything is uploaded (an unknown id used
    // to upload the image to R2 anyway and answer 201, leaving an orphan object).
    const existing = await pool.query('SELECT discover_image_key FROM songs WHERE id = $1 AND church_id = $2', [songId, churchId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Song not found' });
    // Delete old image if one exists
    if (existing.rows[0].discover_image_key) {
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

router.post('/songs/:songId', requireAuth, requirePermission('can_manage_songs'), upload.single('file'), async function(req, res, next) {
  try {
    const songId = req.params.songId;
    const file_type = req.body.file_type;
    const label = req.body.label;
    const key_of = req.body.key_of;
    const churchId = req.churchId;

    const owningSong = await pool.query('SELECT id FROM songs WHERE id = $1 AND church_id = $2', [songId, churchId]);
    if (owningSong.rows.length === 0) {
      return res.status(404).json({ error: 'Song not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const ext = req.file.originalname.split('.').pop();
    if (!contentMatchesExtension(req.file.buffer, (ext || '').toLowerCase())) {
      return res.status(400).json({ error: `This file isn't a real ${ext.toUpperCase()} — it may have been renamed. Please upload the original PDF or ChordPro file.` });
    }
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

router.get('/songs/:songId/files/:fileId/url', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const file = await pool.query(
      `SELECT sf.* FROM song_files sf
       JOIN songs s ON s.id = sf.song_id
       WHERE sf.id = $1 AND sf.song_id = $2 AND s.church_id = $3`,
      [req.params.fileId, req.params.songId, req.churchId]
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

// GET /songs/:songId/files — authenticated: all files for a song, scoped to the caller's church
router.get('/songs/:songId/files', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const owningSong = await pool.query('SELECT id FROM songs WHERE id = $1 AND church_id = $2', [req.params.songId, req.churchId]);
    if (owningSong.rows.length === 0) {
      return res.status(404).json({ error: 'Song not found' });
    }

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

// (removed) GET /public/songs/:songId/files — the unauthenticated, token-only file route
// was the public-link licensing leak. Files/chords/lyrics are now served only by the
// authenticated GET /songs/:songId/files (requireAuth + requireMembership), so a signed-in
// member of the owning church gets them and nobody else does. See
// claude/task-public-link-access-split.md. A request to the old path now 404s (no such route).

router.patch('/songs/:songId/files/:fileId', requireAuth, requirePermission('can_manage_songs'), async function(req, res, next) {
  try {
    const { file_type, label, key_of } = req.body;
    const result = await pool.query(
      `UPDATE song_files sf SET file_type = COALESCE($1, sf.file_type), label = COALESCE($2, sf.label), key_of = $3
       FROM songs s
       WHERE sf.id = $4 AND sf.song_id = $5 AND sf.song_id = s.id AND s.church_id = $6
       RETURNING sf.*`,
      [file_type, label, key_of || null, req.params.fileId, req.params.songId, req.churchId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/songs/:songId/files/:fileId', requireAuth, requirePermission('can_manage_songs'), async function(req, res, next) {
  try {
    const file = await pool.query(
      `SELECT sf.* FROM song_files sf
       JOIN songs s ON s.id = sf.song_id
       WHERE sf.id = $1 AND sf.song_id = $2 AND s.church_id = $3`,
      [req.params.fileId, req.params.songId, req.churchId]
    );
    if (file.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Database row first, then storage. The edited ChordPro copy (edited_r2_key) used to be
    // left behind in R2. Storage cleanup is best-effort: a failed R2 delete leaves an orphan
    // object (harmless), never a file row pointing at nothing.
    await pool.query('DELETE FROM song_files WHERE id = $1', [req.params.fileId]);
    for (const key of [file.rows[0].r2_key, file.rows[0].edited_r2_key].filter(Boolean)) {
      try {
        await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      } catch (e) {
        console.warn('[uploads] R2 delete failed for', key, e.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PUT /uploads/songs/:songId/files/:fileId/chordpro — save edited ChordPro content to R2
router.put('/songs/:songId/files/:fileId/chordpro', requireAuth, requirePermission('can_manage_songs'), async function(req, res, next) {
  try {
    const { content } = req.body;
    if (typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'content is required' });
    }

    const fileResult = await pool.query(
      `SELECT sf.* FROM song_files sf
       JOIN songs s ON s.id = sf.song_id
       WHERE sf.id = $1 AND sf.song_id = $2 AND s.church_id = $3`,
      [req.params.fileId, req.params.songId, req.churchId]
    );
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileResult.rows[0];

    // Reuse existing edited key if present, otherwise create a new one
    const editedKey = file.edited_r2_key || ('edited/' + file.r2_key);

    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: editedKey,
      Body: content,
      ContentType: 'text/plain',
    }));

    await pool.query(
      'UPDATE song_files SET edited_r2_key = $1 WHERE id = $2',
      [editedKey, file.id]
    );

    const url = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: BUCKET, Key: editedKey }),
      { expiresIn: 3600 }
    );

    res.json({ success: true, url, has_edits: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /uploads/songs/:songId/files/:fileId/chordpro-edits — revert to original
router.delete('/songs/:songId/files/:fileId/chordpro-edits', requireAuth, requirePermission('can_manage_songs'), async function(req, res, next) {
  try {
    const fileResult = await pool.query(
      `SELECT sf.* FROM song_files sf
       JOIN songs s ON s.id = sf.song_id
       WHERE sf.id = $1 AND sf.song_id = $2 AND s.church_id = $3`,
      [req.params.fileId, req.params.songId, req.churchId]
    );
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileResult.rows[0];
    if (!file.edited_r2_key) {
      return res.status(400).json({ error: 'No edits to revert' });
    }

    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: file.edited_r2_key }));
    await pool.query(
      'UPDATE song_files SET edited_r2_key = NULL WHERE id = $1',
      [file.id]
    );

    const url = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: BUCKET, Key: file.r2_key }),
      { expiresIn: 3600 }
    );

    res.json({ success: true, url, has_edits: false });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.r2 = r2;
module.exports.BUCKET = BUCKET;
