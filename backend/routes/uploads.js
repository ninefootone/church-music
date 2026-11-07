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
const { normaliseKey } = require('../utils/keys');

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
    // Rehearsal recordings. m4a/aac from iPhone Voice Memos are MP4 containers ("ftyp" at byte 4).
    case 'm4a': return head.subarray(4, 8).toString('latin1') === 'ftyp';
    case 'aac': return head.subarray(4, 8).toString('latin1') === 'ftyp' || (head[0] === 0xff && (head[1] & 0xf6) === 0xf0);
    case 'mp3': return head.subarray(0, 3).toString('latin1') === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0);
    case 'wav': return head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WAVE';
    case 'png':  return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'jpg': case 'jpeg': return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    case 'webp': return head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP';
    default: return false;
  }
}
module.exports.r2 = r2;
module.exports.BUCKET = BUCKET;

// Rehearsal recordings (audio) — see claude/rehearsal-recordings.md.
const AUDIO_EXT = ['m4a', 'mp3', 'aac', 'wav'];
const AUDIO_CONTENT_TYPE = { m4a: 'audio/mp4', aac: 'audio/aac', mp3: 'audio/mpeg', wav: 'audio/wav' };
const DOC_MAX_BYTES = 20 * 1024 * 1024;
const AUDIO_MAX_BYTES = 50 * 1024 * 1024;
const AUDIO_QUOTA_BYTES = 1024 * 1024 * 1024; // 1GB of recordings per church (PDFs/ChordPro don't count)

async function audioBytesUsed(churchId) {
  const r = await pool.query(
    `SELECT COALESCE(SUM(sf.file_size), 0)::bigint AS used
       FROM song_files sf JOIN songs s ON s.id = sf.song_id
      WHERE s.church_id = $1 AND sf.file_type = 'audio'`,
    [churchId]
  );
  return Number(r.rows[0].used);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AUDIO_MAX_BYTES }, // documents are held to DOC_MAX_BYTES in the route
  fileFilter: function(req, file, cb) {
    const allowed = ['application/pdf', 'text/plain', 'application/octet-stream'];
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const allowedExt = ['pdf', 'cho', 'chordpro', 'txt'];
    const isAudio = AUDIO_EXT.includes(ext || '') &&
      (file.mimetype.startsWith('audio/') || file.mimetype === 'video/mp4' || file.mimetype === 'application/octet-stream');
    if (isAudio || (allowed.includes(file.mimetype) && allowedExt.includes(ext || ''))) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Only PDF, ChordPro or audio (m4a, mp3, aac, wav) files are allowed'), { status: 400, expose: true }));
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

// GET /uploads/recordings/usage — how much of the church's 1GB recordings allowance is used.
router.get('/recordings/usage', requireAuth, requireMembership, async function(req, res, next) {
  try {
    res.json({ used: await audioBytesUsed(req.churchId), limit: AUDIO_QUOTA_BYTES });
  } catch (err) {
    next(err);
  }
});

router.post('/songs/:songId', requireAuth, requirePermission('can_manage_songs'), upload.single('file'), async function(req, res, next) {
  try {
    const songId = req.params.songId;
    const file_type = req.body.file_type;
    const label = req.body.label;
    const key_of = normaliseKey(req.body.key_of);
    const churchId = req.churchId;

    const owningSong = await pool.query('SELECT id FROM songs WHERE id = $1 AND church_id = $2', [songId, churchId]);
    if (owningSong.rows.length === 0) {
      return res.status(404).json({ error: 'Song not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const ext = req.file.originalname.split('.').pop();
    const extLower = (ext || '').toLowerCase();
    const isAudio = AUDIO_EXT.includes(extLower);

    // An audio file is always a rehearsal recording, and only audio can be one — keeps
    // recordings reliably out of the sheet-music lists that older iPad builds read.
    if (isAudio !== (file_type === 'audio')) {
      return res.status(400).json({ error: isAudio
        ? 'Audio files can only be uploaded as a rehearsal recording.'
        : 'Only audio files (m4a, mp3, aac, wav) can be uploaded as a rehearsal recording.' });
    }
    if (!isAudio && req.file.size > DOC_MAX_BYTES) {
      return res.status(400).json({ error: 'PDF and ChordPro files can be up to 20MB.' });
    }
    if (isAudio) {
      if (req.body.confirm_own_recording !== 'true') {
        return res.status(400).json({ error: 'Please confirm this is a recording your church made.' });
      }
      const used = await audioBytesUsed(churchId);
      if (used + req.file.size > AUDIO_QUOTA_BYTES) {
        return res.status(400).json({ error: "This would take your church over its 1GB of rehearsal recordings. Delete some older recordings first." });
      }
    }

    if (!contentMatchesExtension(req.file.buffer, extLower)) {
      return res.status(400).json({ error: `This file isn't a real ${ext.toUpperCase()} — it may have been renamed. Please upload the original file.` });
    }
    const r2Key = 'churches/' + churchId + '/songs/' + songId + '/' + uuidv4() + '.' + ext;

    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: r2Key,
      Body: req.file.buffer,
      // Browsers need a real audio type to play a recording; uploads often arrive as octet-stream.
      ContentType: isAudio ? AUDIO_CONTENT_TYPE[extLower] : req.file.mimetype,
    }));

    const result = await pool.query(
      'INSERT INTO song_files (song_id, file_type, label, key_of, r2_key, file_size, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [songId, file_type, label, key_of || null, r2Key, req.file.size, req.user.id]
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
      // Rehearsal recordings (audio) are left out: iPad build 4 treats every file here as sheet
      // music and downloads all of them for offline. See claude/rehearsal-recordings.md.
      "SELECT * FROM song_files WHERE song_id = $1 AND file_type <> 'audio' ORDER BY key_of, file_type",
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
    if (file_type === 'audio') {
      return res.status(400).json({ error: 'Upload an audio file to add a rehearsal recording.' });
    }
    const result = await pool.query(
      // A recording's type can't be changed (and nothing can become one) — see the upload route.
      `UPDATE song_files sf SET file_type = CASE WHEN sf.file_type = 'audio' THEN sf.file_type ELSE COALESCE($1, sf.file_type) END, label = COALESCE($2, sf.label), key_of = $3
       FROM songs s
       WHERE sf.id = $4 AND sf.song_id = $5 AND sf.song_id = s.id AND s.church_id = $6
       RETURNING sf.*`,
      [file_type, label, normaliseKey(key_of) || null, req.params.fileId, req.params.songId, req.churchId]
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
