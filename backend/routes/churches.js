const express = require('express');
const router = express.Router();
const { requireIdParams } = require('../utils/ids');
// Malformed IDs in the URL → 404 before any handler runs (see utils/ids.js).
requireIdParams(router, { churchId: 'Church not found', id: 'Not found' });
const pool = require('../db/pool');
const { requireAuth, requireAdmin, requireMembership } = require('../middleware/auth');
const { sanitizeRichText } = require('../utils/sanitize');
const { seedSampleContent } = require('../utils/sampleContent');
const { notifyAdmin } = require('../utils/email');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const crypto = require('crypto');
// 6 characters from A–Z0–9 via a cryptographic RNG (Math.random is predictable).
const INVITE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const generateInviteCode = () => Array.from({ length: 6 }, () => INVITE_CHARS[crypto.randomInt(INVITE_CHARS.length)]).join('');

// Wrong invite codes per user: max JOIN_MAX_FAILS per JOIN_WINDOW_MS, then 429.
// Stops anyone cycling through codes to find a church. In-memory, so it resets on
// deploy — fine for this purpose.
const JOIN_MAX_FAILS = 10;
const JOIN_WINDOW_MS = 15 * 60 * 1000;
const joinFails = new Map(); // user id -> { count, resetAt }
function joinBlocked(userId) {
  const e = joinFails.get(userId);
  if (!e) return false;
  if (Date.now() > e.resetAt) { joinFails.delete(userId); return false; }
  return e.count >= JOIN_MAX_FAILS;
}
function recordJoinFail(userId) {
  const now = Date.now();
  const e = joinFails.get(userId);
  if (!e || now > e.resetAt) joinFails.set(userId, { count: 1, resetAt: now + JOIN_WINDOW_MS });
  else e.count += 1;
  if (joinFails.size > 10000) { for (const [k, v] of joinFails) if (now > v.resetAt) joinFails.delete(k); }
}
const generateShortId = () => Math.random().toString(36).substring(2, 6);

// One church per person for now (multi-church is a possible future feature). The web app
// only ever shows the first church from /mine (sorted by name), so a second membership
// would silently swap someone into a different church. Revoked memberships don't count.
const ONE_CHURCH_ERROR = "You're already a member of a church. Song Stack doesn't support belonging to more than one church yet — contact hello@songstack.church if you need to move.";
async function hasActiveMembership(userId, exceptChurchId = null) {
  const r = await pool.query(
    `SELECT 1 FROM memberships
     WHERE user_id = $1 AND role != 'revoked' AND ($2::uuid IS NULL OR church_id != $2)
     LIMIT 1`,
    [userId, exceptChurchId]
  );
  return r.rows.length > 0;
}

// Create a church
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, ccli_number } = req.body;
    if (!name) return res.status(400).json({ error: 'Church name required' });
    if (await hasActiveMembership(req.user.id)) return res.status(400).json({ error: ONE_CHURCH_ERROR });

    // Append short random ID to slug to avoid collisions
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const slug = `${baseSlug}-${generateShortId()}`
    const invite_code = generateInviteCode();

    // Church + its first admin membership in one transaction: if the membership insert
    // failed, the church used to be left behind with no admin and nobody able to reach it.
    const client = await pool.connect();
    let church;
    try {
      await client.query('BEGIN');
      church = await client.query(
        'INSERT INTO churches (name, slug, invite_code, created_by, ccli_number) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, slug, invite_code, req.user.id, ccli_number || null]
      );
      await client.query(
        'INSERT INTO memberships (church_id, user_id, role) VALUES ($1, $2, $3)',
        [church.rows[0].id, req.user.id, 'admin']
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    // Sample songs + a draft sample plan (don't count towards free limits). Runs after the
    // commit and never throws, so a failure here can't stop the church being created.
    // Awaited so the dashboard has them on first load.
    const seeded = await seedSampleContent(church.rows[0].id, req.user.clerk_id);
    res.status(201).json({ ...church.rows[0], sample_content: seeded });

    // Tell the SongStack team (after replying — never delays or fails church creation).
    notifyAdmin({
      subject: `New church: ${name}`,
      heading: 'New church created',
      rows: [
        ['Church', name],
        ['Created by', `${req.user.name || ''} ${req.user.email ? `(${req.user.email})` : ''}`.trim()],
        ['CCLI number', ccli_number],
        ['Sample content', `${seeded.songs} song(s), sample plan ${seeded.plan ? 'created' : 'NOT created'}`],
      ],
    }).catch((err) => console.warn('[notify] new church email failed:', err.message));
  } catch (err) {
    next(err);
  }
});

// Join a church by invite code
router.post('/join', requireAuth, async (req, res, next) => {
  try {
    if (joinBlocked(req.user.id)) {
      return res.status(429).json({ error: 'Too many incorrect codes. Please wait 15 minutes and try again.' });
    }
    const invite_code = typeof req.body.invite_code === 'string' ? req.body.invite_code.trim().toUpperCase() : '';
    if (!invite_code) return res.status(400).json({ error: 'Please enter an invite code' });
    const church = await pool.query('SELECT * FROM churches WHERE invite_code = $1', [invite_code]);
    if (church.rows.length === 0) {
      recordJoinFail(req.user.id);
      return res.status(404).json({ error: 'Invalid invite code — please check and try again' });
    }

    const existing = await pool.query(
      'SELECT * FROM memberships WHERE church_id = $1 AND user_id = $2',
      [church.rows[0].id, req.user.id]
    );
    // Same-church cases (already a member / re-joining after removal) are handled below;
    // only block when they belong to a DIFFERENT church.
    if (await hasActiveMembership(req.user.id, church.rows[0].id)) {
      return res.status(400).json({ error: ONE_CHURCH_ERROR });
    }
    if (existing.rows.length > 0) {
      if (existing.rows[0].role === 'revoked') {
        await pool.query(
          'UPDATE memberships SET role = $1 WHERE church_id = $2 AND user_id = $3',
          ['member', church.rows[0].id, req.user.id]
        );
      } else {
        return res.status(400).json({ error: 'You are already a member of this church' });
      }
    } else {
      await pool.query(
        'INSERT INTO memberships (church_id, user_id, role) VALUES ($1, $2, $3)',
        [church.rows[0].id, req.user.id, 'member']
      );
    }

    // Notify admin by email
    try {
      const { sendBrevoEmail, escapeHtml } = require('../utils/email')
      const adminResult = await pool.query(
        `SELECT u.email, u.name
         FROM memberships m
         JOIN users u ON u.id = m.user_id
         WHERE m.church_id = $1 AND m.role = 'admin'
         LIMIT 1`,
        [church.rows[0].id]
      )
      if (adminResult.rows.length) {
        const admin = adminResult.rows[0]
        const adminName = admin.name || 'Admin'
        const memberResult = await pool.query(
          'SELECT email, name FROM users WHERE id = $1',
          [req.user.id]
        )
        if (memberResult.rows.length) {
          const m = memberResult.rows[0]
          const memberName = m.name || m.email
          const sent = await sendBrevoEmail({
            to: admin.email,
            toName: adminName,
            subject: `New member joined ${church.rows[0].name}`,
            htmlContent: `<p>Hi ${escapeHtml(adminName)},</p><p><strong>${escapeHtml(memberName)}</strong> (${escapeHtml(m.email)}) has just joined <strong>${escapeHtml(church.rows[0].name)}</strong> on SongStack.</p><p>You can view and manage your team from your <a href="https://app.songstack.church/dashboard">dashboard</a>.</p><p>— SongStack</p>`
          })
          // sendBrevoEmail resolves even when Brevo rejects the email — surface that.
          if (sent.status >= 300) throw new Error(`Brevo ${sent.status}: ${sent.body}`)
        }
      }
    } catch (emailErr) {
      console.error('Failed to send join notification email:', emailErr)
    }

    res.json(church.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Get my churches
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const churches = await pool.query(
      `SELECT c.*, m.role, m.can_manage_songs, m.can_add_plans, m.can_manage_playlists, m.can_annotate_plans FROM churches c
       JOIN memberships m ON m.church_id = c.id
       WHERE m.user_id = $1 AND m.role != 'revoked'
       ORDER BY c.name`,
      [req.user.id]
    );
    res.json(churches.rows);
  } catch (err) {
    next(err);
  }
});

// (removed 2026-10-02) DELETE /:churchId/members/:memberId — unused legacy route that
// skipped the last-admin check. Members are removed via DELETE /api/members/:membershipId.

// Get church details
router.get('/:churchId', requireAuth, requireMembership, async (req, res, next) => {
  try {
    const church = await pool.query('SELECT * FROM churches WHERE id = $1', [req.churchId]);
    if (church.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(church.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update church settings (admin only)
router.patch('/:churchId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    // Only fields that were sent are changed: a request without ccli_number used to blank it.
    // The Settings page sends both; this keeps any future caller from wiping the CCLI number.
    const hasCcli = 'ccli_number' in body;
    const church = await pool.query(
      `UPDATE churches SET name = COALESCE($1, name)${hasCcli ? ', ccli_number = $3' : ''} WHERE id = $2 RETURNING *`,
      hasCcli ? [name || null, req.churchId, body.ccli_number || null] : [name || null, req.churchId]
    );
    if (church.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(church.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Upload church logo (admin only)
router.post('/:churchId/logo', requireAuth, requireAdmin, upload.single('logo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const ext = req.file.originalname.split('.').pop().toLowerCase();
    // Content-Type comes from OUR list, not the browser's claim: logos are served
    // from the public R2 URL, so a file labelled text/html would otherwise be
    // served as a web page on our storage domain. SVG can carry script when opened
    // directly, so it is sent as a download (an <img> tag still displays it).
    const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml' };
    if (!TYPES[ext]) return res.status(400).json({ error: 'Logo must be a JPG, PNG, WebP or SVG image' });

    const key = `logos/${uuidv4()}.${ext}`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: TYPES[ext],
      ...(ext === 'svg' ? { ContentDisposition: 'attachment' } : {}),
    }));

    const logo_url = `${process.env.R2_PUBLIC_URL}/${key}`;
    const church = await pool.query(
      'UPDATE churches SET logo_url = $1 WHERE id = $2 RETURNING *',
      [logo_url, req.churchId]
    );

    res.json(church.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Regenerate invite code (admin only)
router.post('/:churchId/regenerate-invite', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const invite_code = generateInviteCode();
    const church = await pool.query(
      'UPDATE churches SET invite_code = $1 WHERE id = $2 RETURNING *',
      [invite_code, req.churchId]
    );
    res.json(church.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Get roles for a church
router.get('/:churchId/roles', requireAuth, requireMembership, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM church_roles WHERE church_id = $1 ORDER BY sort_order, name',
      [req.churchId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Save roles for a church (admin only) — receives full array, diffs against DB
router.put('/:churchId/roles', requireAuth, requireAdmin, async (req, res, next) => {
  const { roles } = req.body; // [{ id?, name, sort_order }]
  if (!Array.isArray(roles)) return res.status(400).json({ error: 'roles must be an array' });

  const churchId = req.churchId;
  // Connect inside a try: a database outage must reach next(err) (→ 500), not escape as an
  // unhandled rejection that leaves the request hanging.
  let client;
  try { client = await pool.connect(); } catch (err) { return next(err); }

  try {
    await client.query('BEGIN');

    // Get existing roles
    const existing = await client.query(
      'SELECT * FROM church_roles WHERE church_id = $1',
      [churchId]
    );
    const existingIds = existing.rows.map(r => r.id);
    const incomingIds = roles.filter(r => r.id).map(r => r.id);

    // Delete removed roles
    const toDelete = existingIds.filter(id => !incomingIds.includes(id));
    for (const id of toDelete) {
      await client.query('DELETE FROM church_roles WHERE id = $1', [id]);
    }

    // Upsert remaining/new roles
    for (let i = 0; i < roles.length; i++) {
      const { id, name } = roles[i];
      if (!name || !name.trim()) continue;
      if (id) {
        await client.query(
          'UPDATE church_roles SET name = $1, sort_order = $2 WHERE id = $3 AND church_id = $4',
          [name.trim(), i, id, churchId]
        );
      } else {
        await client.query(
          'INSERT INTO church_roles (church_id, name, sort_order) VALUES ($1, $2, $3)',
          [churchId, name.trim(), i]
        );
      }
    }

    await client.query('COMMIT');
    const updated = await pool.query(
      'SELECT * FROM church_roles WHERE church_id = $1 ORDER BY sort_order, name',
      [churchId]
    );
    res.json(updated.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Get usage count for a role name (for delete/rename warnings)
router.get('/:churchId/roles/usage', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'name required' });
    const result = await pool.query(
      `SELECT COUNT(*) FROM plan_musicians pm
       JOIN plans p ON p.id = pm.plan_id
       WHERE p.church_id = $1 AND pm.role = $2`,
      [req.churchId, name]
    );
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    next(err);
  }
});

// Plan item types (GET/PUT /:churchId/plan-item-types) were removed 2026-10-03: replaced by
// the Service items library (merge-item-types-into-snippets.js, 2026-09-03) and no longer
// called by the website or iPad app. The church_plan_item_types table is left in place.

// ============================================================
// Liturgy snippets — per-church reusable service text (creeds,
// prayers, welcomes, benedictions). Read: any member. Manage: admin.
// ============================================================

// List snippets
router.get('/:churchId/liturgy-snippets', requireAuth, requireMembership, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM church_liturgy_snippets WHERE church_id = $1 ORDER BY LOWER(title)',
      [req.churchId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Create a snippet (admin only)
router.post('/:churchId/liturgy-snippets', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const title = (req.body.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const content = sanitizeRichText(req.body.content);
    const note = (req.body.note || '').trim() || null;

    const next_sort = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM church_liturgy_snippets WHERE church_id = $1',
      [req.churchId]
    );

    const result = await pool.query(
      `INSERT INTO church_liturgy_snippets (church_id, title, content, note, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.churchId, title, content, note, next_sort.rows[0].n]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update a snippet (admin only)
router.put('/:churchId/liturgy-snippets/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const title = (req.body.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const content = sanitizeRichText(req.body.content);
    const note = (req.body.note || '').trim() || null;

    const result = await pool.query(
      `UPDATE church_liturgy_snippets
       SET title = $1, content = $2, note = $3
       WHERE id = $4 AND church_id = $5 RETURNING *`,
      [title, content, note, req.params.id, req.churchId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Snippet not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete a snippet (admin only)
router.delete('/:churchId/liturgy-snippets/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM church_liturgy_snippets WHERE id = $1 AND church_id = $2 RETURNING id',
      [req.params.id, req.churchId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Snippet not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
