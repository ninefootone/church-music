const express = require('express');
const Sentry = require('@sentry/node');
const router = express.Router();
const { isIsoDate, isClockTime, DATE_MESSAGE, START_TIME_MESSAGE } = require('../utils/dates');
const { requireIdParams, isUuid } = require('../utils/ids');
// Malformed IDs in the URL → 404 before any handler runs (see utils/ids.js).
requireIdParams(router, { id: 'Plan not found', itemId: 'Plan item not found', musicianId: 'Musician not found' });
const { sendBrevoEmail, escapeHtml } = require('../utils/email');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || ('https://' + process.env.R2_ACCOUNT_ID + '.r2.cloudflarestorage.com'),
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});
const R2_BUCKET = process.env.R2_BUCKET_NAME;
const pool = require('../db/pool');
const { sanitizeRichText } = require('../utils/sanitize');
const { insertTemplateItems } = require('../utils/planTemplateItems');
const { requireAuth, requireMembership, requireAdmin, requirePermission } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Loads a plan scoped to the caller's church. Returns null if it doesn't exist
// there (callers send 404, so other churches' plan ids look the same as missing).
async function loadChurchPlan(planId, churchId) {
  const r = await pool.query(
    'SELECT id, created_by, status FROM plans WHERE id=$1 AND church_id=$2',
    [planId, churchId]
  );
  return r.rows[0] || null;
}

// Same rule the plan detail page uses to show edit controls:
// admin, the plan's creator, or "Add & edit plans".
function canEditPlan(req, plan) {
  return req.membership.role === 'admin'
    || plan.created_by === req.user.clerk_id
    || !!req.membership.can_add_plans;
}

function canSeeDraftPlans(req) {
  return req.membership.role === 'admin' || !!req.membership.can_add_plans;
}

router.get('/', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const churchId = req.churchId;
    const upcoming = req.query.upcoming;

    let query = `
      SELECT s.*,
        COUNT(si.id) FILTER (WHERE si.type = 'song') AS song_count
      FROM plans s
      LEFT JOIN plan_items si ON si.plan_id = s.id
      WHERE s.church_id = $1
    `;
    const params = [churchId];

    if (upcoming === 'true') query += ' AND s.plan_date >= CURRENT_DATE';
    if (upcoming === 'false') query += ' AND s.plan_date < CURRENT_DATE';

    const canSeeDrafts = req.membership.role === 'admin' || req.membership.can_add_plans;
    if (!canSeeDrafts) query += ` AND s.status = 'published'`;

    query += ' GROUP BY s.id ORDER BY s.plan_date ' + (upcoming === 'false' ? 'DESC' : 'ASC') + ', s.plan_sort_order ASC, s.plan_start_time ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/plans/my-upcoming — plans where the logged-in user is listed as a musician
router.get('/my-upcoming', requireAuth, requireMembership, async function(req, res, next) {
  try {
    // Same draft rule as GET / — only admins and can_add_plans members see drafts.
    // (Without this, a musician on a draft — e.g. a duplicated plan — saw it in
    // Upcoming and then got "Plan not found" when opening it.)
    const canSeeDrafts = req.membership.role === 'admin' || req.membership.can_add_plans;
    const result = await pool.query(
      `SELECT p.id, p.plan_date, p.plan_time, p.plan_start_time, p.plan_sort_order, p.title, p.status,
              STRING_AGG(pm.role, ', ' ORDER BY pm.role) AS musician_roles
       FROM plans p
       JOIN plan_musicians pm ON pm.plan_id = p.id
       WHERE p.church_id = $1
         AND pm.user_id = $2
         AND p.plan_date >= CURRENT_DATE
         ${canSeeDrafts ? '' : "AND p.status = 'published'"}
       GROUP BY p.id
       ORDER BY p.plan_date ASC, p.plan_sort_order ASC, p.plan_start_time ASC NULLS LAST
       LIMIT 10`,
      [req.churchId, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/musicians', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const plan = await loadChurchPlan(req.params.id, req.churchId);
    if (!plan || (plan.status === 'draft' && !canSeeDraftPlans(req))) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    const result = await pool.query(
      `SELECT sm.id, sm.name, sm.role, sm.user_id, sm.created_at
       FROM plan_musicians sm
       WHERE sm.plan_id = $1
       ORDER BY sm.created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const churchId = req.churchId;
    const plan = await pool.query(
      'SELECT * FROM plans WHERE id = $1 AND church_id = $2',
      [req.params.id, churchId]
    );
    if (plan.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });

    const canSeeDrafts = req.membership.role === 'admin' || req.membership.can_add_plans;
    if (!canSeeDrafts && plan.rows[0].status === 'draft') {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const items = await pool.query(
      `SELECT si.id, si.type, si.phase, si.title, si.notes, si.content, si.key_override, si.position,
        si.custom_arrangement, si.duration_minutes,
        s.id AS song_id, s.title AS song_title, s.author AS song_author,
        s.default_key AS song_default_key, s.category AS song_category,
        s.ccli_number AS song_ccli_number,
        s.suggested_arrangement AS song_suggested_arrangement,
        s.lyrics AS song_lyrics,
        s.default_duration AS song_default_duration
       FROM plan_items si
       LEFT JOIN songs s ON s.id = si.song_id
       WHERE si.plan_id = $1
       ORDER BY si.position`,
      [req.params.id]
    );

    res.json(Object.assign({}, plan.rows[0], { items: items.rows }));
  } catch (err) {
    next(err);
  }
});

router.get('/public/:token', async function(req, res, next) {
  try {
    // Only the fields the share pages display (+ id for the queries below, and
    // church_id, which the signed-in Set view sends as x-church-id). Not created_by,
    // public_token, timestamps, etc.
    const plan = await pool.query(
      `SELECT id, church_id, status, title, plan_date, plan_time, plan_start_time, plan_sort_order, pre_service_notes
         FROM plans WHERE public_token = $1`,
      [req.params.token]
    );
    if (plan.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    // Drafts aren't shared until published (decided with Jon 2026-10-02).
    if (plan.rows[0].status !== 'published') {
      return res.status(404).json({ error: "This plan isn't published yet", code: 'not_published' });
    }

    const items = await pool.query(
      `SELECT si.type, si.phase, si.title, si.notes, si.content, si.key_override, si.position,
        si.custom_arrangement, si.duration_minutes,
        s.id AS song_id, s.title AS song_title, s.author AS song_author,
        s.default_key AS song_default_key, s.youtube_url AS song_youtube_url,
        s.ccli_number AS song_ccli_number,
        s.suggested_arrangement AS song_suggested_arrangement,
        s.default_duration AS song_default_duration
       FROM plan_items si
       LEFT JOIN songs s ON s.id = si.song_id
       WHERE si.plan_id = $1
       ORDER BY si.position`,
      [plan.rows[0].id]
    );

    // Musicians are included here because the public share page has no login;
    // GET /:id/musicians now requires church membership.
    const musicians = await pool.query(
      `SELECT user_id, name, role FROM plan_musicians WHERE plan_id = $1 ORDER BY created_at ASC`,
      [plan.rows[0].id]
    );

    const { id, status, ...publicPlan } = plan.rows[0];
    res.json(Object.assign(publicPlan, { items: items.rows, musicians: musicians.rows }));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requirePermission('can_add_plans'), async function(req, res, next) {
  try {
    const churchId = req.churchId;

    // Free tier gate — max 1 plan (free_access churches are exempt)
    const church = await pool.query('SELECT subscription_status, free_access FROM churches WHERE id = $1', [churchId]);
    const status = church.rows[0]?.subscription_status;
    const freeAccess = church.rows[0]?.free_access;
    if (!freeAccess && (!status || status === 'free')) {
      const count = await pool.query('SELECT COUNT(*) FROM plans WHERE church_id = $1', [churchId]);
      if (parseInt(count.rows[0].count) >= 1) {
        return res.status(403).json({ error: 'You have reached the 1 plan limit on the free plan. Upgrade in Settings to add more.' });
      }
    }

    // Optional template: its running order is copied in, and its time/title/
    // notes fill any field the request didn't send.
    // Date is required (NOT NULL column — a missing one used to come back as a 500).
    if (!isIsoDate(req.body.plan_date)) return res.status(400).json({ error: DATE_MESSAGE });
    if (req.body.plan_start_time && !isClockTime(req.body.plan_start_time)) {
      return res.status(400).json({ error: START_TIME_MESSAGE });
    }

    let template = null;
    if (req.body.template_id) {
      if (!isUuid(req.body.template_id)) return res.status(404).json({ error: 'Template not found' });
      const t = await pool.query(
        'SELECT * FROM plan_templates WHERE id=$1 AND church_id=$2',
        [req.body.template_id, churchId]
      );
      if (t.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
      template = t.rows[0];
    }
    const pick = (field) => (req.body[field] !== undefined ? req.body[field] : template?.[field]);

    const plan_date = req.body.plan_date;
    const plan_time = pick('plan_time') || null;
    const plan_start_time = pick('plan_start_time') || null;
    const plan_sort_order = pick('plan_sort_order') ?? 0;
    const title = pick('title') || null;
    const pre_service_notes = pick('pre_service_notes') || null;
    const planStatus = ['draft', 'published'].includes(req.body.status) ? req.body.status : 'published';
    const public_token = uuidv4();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const plan = await client.query(
        'INSERT INTO plans (church_id, plan_date, plan_time, plan_start_time, plan_sort_order, title, public_token, created_by, status, pre_service_notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
        [churchId, plan_date, plan_time, plan_start_time, plan_sort_order, title, public_token, req.user.clerk_id, planStatus, pre_service_notes]
      );
      if (template) await insertTemplateItems(client, plan.rows[0].id, template.items);
      await client.query('COMMIT');
      res.status(201).json(plan.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const existing = await pool.query(
      'SELECT created_by FROM plans WHERE id=$1 AND church_id=$2',
      [req.params.id, req.churchId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const isAdmin = req.membership.role === 'admin';
    const isOwner = existing.rows[0].created_by === req.user.clerk_id;
    const canEditAny = req.membership.can_add_plans;
    if (!isAdmin && !isOwner && !canEditAny) return res.status(403).json({ error: 'Not authorised' });
    // Only fields actually sent are updated. This used to overwrite every column, so the
    // Plan details page (which doesn't send pre_service_notes) wiped the pre-service notes.
    const body = req.body || {};
    if ('plan_date' in body && !isIsoDate(body.plan_date)) return res.status(400).json({ error: DATE_MESSAGE });
    if ('plan_start_time' in body && body.plan_start_time && !isClockTime(body.plan_start_time)) {
      return res.status(400).json({ error: START_TIME_MESSAGE });
    }
    const sets = [];
    const params = [];
    const set = (col, val) => { params.push(val); sets.push(`${col}=$${params.length}`); };
    if ('plan_date' in body) set('plan_date', body.plan_date);
    if ('plan_time' in body) set('plan_time', body.plan_time || null);
    if ('plan_start_time' in body) set('plan_start_time', body.plan_start_time || null);
    if ('plan_sort_order' in body) {
      const n = parseInt(body.plan_sort_order, 10);
      set('plan_sort_order', Number.isFinite(n) ? n : 0);
    }
    if ('title' in body) set('title', body.title ?? null);
    if ('pre_service_notes' in body) set('pre_service_notes', body.pre_service_notes || null);
    if (['draft', 'published'].includes(body.status)) set('status', body.status);
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id, req.churchId);
    const plan = await pool.query(
      `UPDATE plans SET ${sets.join(', ')} WHERE id=$${params.length - 1} AND church_id=$${params.length} RETURNING *`,
      params
    );
    if (plan.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(plan.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/items', requireAuth, requireMembership, async function(req, res, next) {
  const planId = req.params.id;
  const items = req.body.items;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
  // Each item must be an object with a type; otherwise the insert below would
  // throw (a null item or missing type used to come back as a 500).
  if (items.length > 300) return res.status(400).json({ error: 'Too many items (max 300)' });
  for (const it of items) {
    if (!it || typeof it !== 'object' || typeof it.type !== 'string' || !it.type.trim() || it.type.length > 50) {
      return res.status(400).json({ error: 'Each item needs a type' });
    }
  }

  let client;
  try {
    // Same rule as PUT /:id — plan must belong to this church, and the caller
    // must be an admin, the plan's creator, or have can_add_plans.
    const existing = await pool.query(
      'SELECT created_by FROM plans WHERE id=$1 AND church_id=$2',
      [planId, req.churchId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const isAdmin = req.membership.role === 'admin';
    const isOwner = existing.rows[0].created_by === req.user.clerk_id;
    const canEditAny = req.membership.can_add_plans;
    if (!isAdmin && !isOwner && !canEditAny) return res.status(403).json({ error: 'Not authorised' });

    // Every song_id must be one of THIS church's songs. Without this, a crafted
    // request could link another church's song, and its title/lyrics would then
    // show through the plan-detail join.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const songIds = [...new Set(items.map(it => it && it.song_id).filter(Boolean))];
    if (songIds.some(id => typeof id !== 'string' || !UUID_RE.test(id))) {
      return res.status(400).json({ error: 'Invalid song id' });
    }
    if (songIds.length > 0) {
      const owned = await pool.query(
        'SELECT id FROM songs WHERE church_id = $1 AND id = ANY($2::uuid[])',
        [req.churchId, songIds]
      );
      if (owned.rows.length !== songIds.length) {
        return res.status(400).json({ error: 'One or more songs were not found in this church' });
      }
    }

    // Delete + re-insert in one transaction so a failure can't leave the plan half-empty.
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('DELETE FROM plan_items WHERE plan_id = $1', [planId]);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await client.query(
        'INSERT INTO plan_items (plan_id, type, song_id, title, notes, content, key_override, position, custom_arrangement, duration_minutes, phase) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [planId, item.type.trim(), item.song_id || null, item.title || null, item.notes || null, sanitizeRichText(item.content), item.key_override || null, i, item.custom_arrangement || null, parseInt(item.duration_minutes, 10) > 0 ? parseInt(item.duration_minutes, 10) : null, item.phase === 'pre-service' ? 'pre-service' : 'service']
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    if (client) client.release();
  }
});

// PATCH /:id/items/:itemId/arrangement — update custom arrangement only (annotators + full editors)
router.patch('/:id/items/:itemId/arrangement', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const { custom_arrangement } = req.body;
    const { id: planId, itemId } = req.params;
    // Full plan editors (same rule as PUT /:id/items) or "Add notes to plan items".
    const plan = await loadChurchPlan(planId, req.churchId);
    if (!plan) return res.status(404).json({ error: 'Not found' });
    const canEdit = canEditPlan(req, plan);
    // Annotators who can't see drafts mustn't reach draft plans either.
    if (plan.status === 'draft' && !canEdit && !canSeeDraftPlans(req)) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!canEdit && !req.membership.can_annotate_plans) {
      return res.status(403).json({ error: 'Not authorised' });
    }

    const result = await pool.query(
      'UPDATE plan_items SET custom_arrangement=$1 WHERE id=$2 AND plan_id=$3 RETURNING *',
      [custom_arrangement || null, itemId, planId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/items/:itemId/notes — update notes only (annotators + full editors)
router.patch('/:id/items/:itemId/notes', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const { notes } = req.body;
    const { id: planId, itemId } = req.params;
    // Full plan editors (same rule as PUT /:id/items) or "Add notes to plan items".
    const plan = await loadChurchPlan(planId, req.churchId);
    if (!plan) return res.status(404).json({ error: 'Not found' });
    const canEdit = canEditPlan(req, plan);
    // Annotators who can't see drafts mustn't reach draft plans either.
    if (plan.status === 'draft' && !canEdit && !canSeeDraftPlans(req)) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!canEdit && !req.membership.can_annotate_plans) {
      return res.status(403).json({ error: 'Not authorised' });
    }

    const result = await pool.query(
      'UPDATE plan_items SET notes=$1 WHERE id=$2 AND plan_id=$3 RETURNING *',
      [notes || null, itemId, planId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/musicians', requireAuth, requireMembership, async function(req, res, next) {

  try {
    const { name, role, user_id } = req.body;
    if (!name || !role) return res.status(400).json({ error: 'name and role are required' });

    const plan = await loadChurchPlan(req.params.id, req.churchId);
    if (!plan) return res.status(404).json({ error: 'Not found' });
    if (!canEditPlan(req, plan)) return res.status(403).json({ error: 'Not authorised' });

    // A linked user must be a member of this church.
    if (user_id) {
      const member = await pool.query(
        "SELECT 1 FROM memberships WHERE church_id=$1 AND user_id=$2 AND role != 'revoked'",
        [req.churchId, user_id]
      );
      if (member.rows.length === 0) return res.status(400).json({ error: 'That person is not a member of this church' });
    }

    const result = await pool.query(
      `INSERT INTO plan_musicians (plan_id, user_id, name, role)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, user_id || null, name, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/musicians/:musicianId', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const plan = await loadChurchPlan(req.params.id, req.churchId);
    if (!plan) return res.status(404).json({ error: 'Not found' });
    if (!canEditPlan(req, plan)) return res.status(403).json({ error: 'Not authorised' });
    await pool.query(
      `DELETE FROM plan_musicians WHERE id = $1 AND plan_id = $2`,
      [req.params.musicianId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const existing = await pool.query(
      'SELECT created_by FROM plans WHERE id=$1 AND church_id=$2',
      [req.params.id, req.churchId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const isAdmin = req.membership.role === 'admin';
    const isOwner = existing.rows[0].created_by === req.user.clerk_id;
    if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Not authorised' });
    await pool.query('DELETE FROM plans WHERE id = $1 AND church_id = $2', [req.params.id, req.churchId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/email', requireAuth, requireMembership, async function(req, res, next) {
  const planId = req.params.id
  const churchId = req.churchId
  // array of { email, name }. Validate, de-duplicate and cap: this sends real
  // email from our domain, so it must not be usable as an open relay.
  const MAX_RECIPIENTS = 100
  const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/
  if (!Array.isArray(req.body.recipients) || req.body.recipients.length === 0) {
    return res.status(400).json({ error: 'No recipients provided' })
  }
  const seen = new Set()
  const recipients = []
  for (const r of req.body.recipients) {
    const email = typeof r?.email === 'string' ? r.email.trim() : ''
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: `Invalid email address: ${String(r?.email ?? '').slice(0, 100)}` })
    }
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    recipients.push({ email, name: typeof r.name === 'string' ? r.name.trim().slice(0, 100) : '' })
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return res.status(400).json({ error: `Too many recipients (max ${MAX_RECIPIENTS})` })
  }

  try {
    // Fetch plan
    const planResult = await pool.query(
      'SELECT p.*, c.name AS church_name FROM plans p JOIN churches c ON c.id = p.church_id WHERE p.id = $1 AND p.church_id = $2',
      [planId, churchId]
    )
    if (planResult.rows.length === 0) return res.status(404).json({ error: 'Plan not found' })
    const plan = planResult.rows[0]
    // Same people the plan page shows the Email button to.
    if (!canEditPlan(req, plan)) return res.status(403).json({ error: 'Not authorised' })

    // Fetch items
    const itemsResult = await pool.query(
      `SELECT si.*, s.title AS song_title, s.default_key AS song_default_key, s.category AS song_category
       FROM plan_items si
       LEFT JOIN songs s ON s.id = si.song_id
       WHERE si.plan_id = $1
       ORDER BY si.position ASC`,
      [planId]
    )
    const items = itemsResult.rows

    // Fetch files for each song item
    const songIds = [...new Set(items.filter(i => i.song_id).map(i => i.song_id))]
    let filesBySongId = {}
    if (songIds.length > 0) {
      const filesResult = await pool.query(
        `SELECT f.song_id, f.label, f.file_type, f.key_of, f.r2_key
         FROM song_files f
         WHERE f.song_id = ANY($1::uuid[])
         ORDER BY f.uploaded_at ASC`,
        [songIds]
      )
      for (const file of filesResult.rows) {
        file.signedUrl = await getSignedUrl(
          r2,
          new GetObjectCommand({ Bucket: R2_BUCKET, Key: file.r2_key }),
          { expiresIn: 60 * 60 * 24 * 7 } // 7 days
        );
        if (!filesBySongId[file.song_id]) filesBySongId[file.song_id] = []
        filesBySongId[file.song_id].push(file)
      }
    }

    // Fetch musicians
    const musiciansResult = await pool.query(
      `SELECT sm.name, sm.role FROM plan_musicians sm WHERE sm.plan_id = $1 ORDER BY sm.id ASC`,
      [planId]
    )
    const musicians = musiciansResult.rows

    // Format date
    const planDate = plan.plan_date
      ? new Date(plan.plan_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'Date TBC'

    // Build timing calculator
    const hasTimings = !!plan.plan_start_time
    const hasDurations = items.some(i => i.duration_minutes)
    let runningMinutes = 0
    if (hasTimings) {
      const [h, m] = plan.plan_start_time.slice(0, 5).split(':').map(Number)
      runningMinutes = h * 60 + m
    }

    // Build song rows HTML
    const itemsHtml = items.map((item, i) => {
      if (item.type !== 'song') {
        const rawLabel = item.type === 'song_slot'
          ? (item.title ? `${item.title} — song to be chosen` : 'Song to be chosen')
          : (item.title || (item.type.charAt(0).toUpperCase() + item.type.slice(1)))
        const label = escapeHtml(rawLabel)
        // item.content is already sanitised to <p>/<br>/<strong>/<em> on save.
        const contentHtml = item.content ? `<div style="font-size:13px;color:#374151;font-style:normal;line-height:1.6;margin-top:6px;">${item.content}</div>` : ''
        const noteHtml = item.notes ? `<div style="font-size:12px;color:#6b7280;font-style:italic;margin-top:4px;">${escapeHtml(item.notes).replace(/\n/g, '<br>')}</div>` : ''
        let timingCell = ''
        if (hasTimings || hasDurations) {
          const hh = String(Math.floor(runningMinutes / 60)).padStart(2, '0')
          const mm = String(runningMinutes % 60).padStart(2, '0')
          const timeStr = hasTimings ? `<span style="font-size:12px;font-weight:600;color:#4b7fa5;">${hh}:${mm}</span>` : ''
          const durStr = item.duration_minutes ? `<span style="font-size:12px;color:#9ca3af;margin-left:4px;">${item.duration_minutes} mins</span>` : ''
          timingCell = `<td style="padding:10px 16px;white-space:nowrap;width:80px;">${timeStr}${durStr}</td>`
        }
        if (item.duration_minutes) runningMinutes += item.duration_minutes
        return `<tr style="border-bottom:1px solid #e5e7eb;">${hasTimings || hasDurations ? timingCell : `<td style="width:80px;"></td>`}<td colspan="2" style="padding:10px 16px;background:#f8f9fa;font-size:13px;color:#666;"><span style="font-style:italic;">${label}</span>${contentHtml}${noteHtml}</td></tr>`
      }
      const title = item.song_title || 'Untitled'
      const key = item.key_override || item.song_default_key || ''
      const keyBadge = key ? `<span style="display:inline-block;padding:2px 8px;background:#dbeafe;color:#1e40af;border-radius:4px;font-size:11px;font-weight:600;margin-left:6px;">${escapeHtml(key)}</span>` : ''
      const arrangement = item.custom_arrangement || ''
      const arrangementHtml = arrangement ? `<div style="font-size:12px;color:#6b7280;margin-top:3px;">${escapeHtml(arrangement)}</div>` : ''
      const files = filesBySongId[item.song_id] || []
      const fileLinks = files.map(f => {
        const label = [f.label, f.key_of].filter(Boolean).join(' — ')
        return `<a href="${escapeHtml(f.signedUrl)}" style="display:inline-block;margin-right:6px;margin-top:4px;padding:3px 10px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:4px;font-size:11px;color:#1d4ed8;text-decoration:none;">${escapeHtml(label)}</a>`
      }).join('')
      const hh = String(Math.floor(runningMinutes / 60)).padStart(2, '0')
      const mm = String(runningMinutes % 60).padStart(2, '0')
      const timeStr = hasTimings ? `<span style="font-size:12px;font-weight:600;color:#4b7fa5;">${hh}:${mm}</span>` : ''
      const durStr = item.duration_minutes ? `<span style="font-size:12px;color:#9ca3af;margin-left:4px;">${item.duration_minutes} mins</span>` : ''
      const timingCell = (hasTimings || hasDurations)
        ? `<td style="padding:10px 16px;white-space:nowrap;width:80px;vertical-align:top;">${timeStr}${durStr}</td>`
        : `<td style="width:80px;"></td>`
      if (item.duration_minutes) runningMinutes += item.duration_minutes
      return `<tr style="border-bottom:1px solid #e5e7eb;">
        ${timingCell}
        <td style="padding:10px 16px;">
          <div style="font-size:15px;font-weight:600;color:#111827;">${escapeHtml(title)}${keyBadge}</div>
          ${arrangementHtml}
          ${fileLinks ? `<div style="margin-top:4px;">${fileLinks}</div>` : ''}
        </td>
        <td style="padding:10px 16px;font-size:13px;color:#6b7280;">${item.song_category ? escapeHtml(item.song_category.replace(/_/g, '-').replace(/\b\w/g, c => c.toUpperCase())) : ''}</td>
      </tr>`
    }).join('')

    // Musicians section — group roles by name
    const musicianGroups = {}
    for (const m of musicians) {
      if (!musicianGroups[m.name]) musicianGroups[m.name] = []
      if (m.role) musicianGroups[m.name].push(m.role)
    }
    const musicianRows = Object.keys(musicianGroups).length > 0
      ? Object.entries(musicianGroups).map(([name, roles]) =>
          `<tr><td style="padding:6px 16px;font-size:14px;color:#111827;">${escapeHtml(name)}</td><td style="padding:6px 16px;font-size:13px;color:#6b7280;">${escapeHtml(roles.join(', '))}</td></tr>`
        ).join('')
      : `<tr><td colspan="2" style="padding:10px 16px;font-size:13px;color:#9ca3af;font-style:italic;">No musicians listed</td></tr>`

    const preServiceNotesHtml = plan.pre_service_notes && plan.plan_start_time
      ? `<div style="padding:12px 16px;font-size:13px;color:#4b5563;white-space:pre-line;border-bottom:1px solid #e5e7eb;">${escapeHtml(plan.pre_service_notes)}</div>`
      : ''
    const planTitle = plan.title ? ` — ${escapeHtml(plan.title)}` : ''
    const planTime = plan.plan_time ? `<p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">${escapeHtml(plan.plan_time)}</p>` : ''
    const publicUrl = `${process.env.FRONTEND_URL || 'https://songstack.church'}/s/${plan.public_token}`

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    
    <div style="background:#4b7fa5;padding:24px 32px;">
      <p style="margin:0;color:rgba(255,255,255,0.8);font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(plan.church_name)}</p>
      <h1 style="margin:4px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Plan${planTitle}</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:16px;">${planDate}</p>
      ${planTime}
    </div>

    <div style="padding:24px 0;">
      ${preServiceNotesHtml}
      <h2 style="margin:0 16px 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#9ca3af;">Songs</h2>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;">
        ${itemsHtml}
      </table>
    </div>

    <div style="padding:0 0 24px;">
      <h2 style="margin:0 16px 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#9ca3af;">Musicians</h2>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;">
        ${musicianRows}
      </table>
    </div>

    <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e5e7eb;text-align:center;">
      <a href="${publicUrl}" style="display:inline-block;padding:10px 24px;background:#4b7fa5;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">View Full Plan →</a>
      <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">Sent via Song Stack · songstack.church</p>
    </div>

  </div>
</body>
</html>`

    const subject = `${plan.church_name} — Plan for ${planDate}`

    // Send to each recipient
    const sendResults = await Promise.allSettled(
      recipients.map(r =>
        sendBrevoEmail({ to: r.email, toName: r.name || r.email, subject, htmlContent })
      )
    )

    const failures = sendResults.filter(r => r.status === 'rejected' || (r.value && r.value.status >= 400))
    if (failures.length > 0) {
      console.error('Some emails failed:', failures)
    }

    res.json({ success: true, sent: recipients.length - failures.length, failed: failures.length })
  } catch (err) {
    console.error('Plan email error:', err)
    Sentry.captureException(err)
    res.status(500).json({ error: 'Failed to send email' })
  }
})

router.post('/:id/duplicate', requireAuth, requirePermission('can_add_plans'), async function(req, res, next) {
  const { plan_date, plan_time, plan_start_time, plan_sort_order, title } = req.body;
  if (!plan_date) return res.status(400).json({ error: 'Date is required' });

  let client;
  try {
    const source = await pool.query(
      'SELECT * FROM plans WHERE id=$1 AND church_id=$2',
      [req.params.id, req.churchId]
    );
    if (source.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    const orig = source.rows[0];
    const public_token = uuidv4();

    // Plan + items + musicians in one transaction, so a failure can't leave a
    // half-copied draft behind.
    client = await pool.connect();
    await client.query('BEGIN');

    const newPlan = await client.query(
      `INSERT INTO plans (church_id, plan_date, plan_time, plan_start_time, plan_sort_order, title, public_token, created_by, status, pre_service_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9) RETURNING *`,
      [req.churchId, plan_date, plan_time, plan_start_time ?? orig.plan_start_time, plan_sort_order ?? orig.plan_sort_order, title ?? orig.title, public_token, req.user.clerk_id, orig.pre_service_notes ?? null]
    );
    const newId = newPlan.rows[0].id;

    await client.query(
      `INSERT INTO plan_items (plan_id, type, title, notes, content, song_id, key_override, position, custom_arrangement, duration_minutes, phase)
       SELECT $1, type, title, notes, content, song_id, key_override, position, custom_arrangement, duration_minutes, COALESCE(phase, 'service')
         FROM plan_items WHERE plan_id = $2 ORDER BY position`,
      [newId, orig.id]
    );

    await client.query(
      `INSERT INTO plan_musicians (plan_id, name, role, user_id)
       SELECT $1, name, role, user_id FROM plan_musicians WHERE plan_id = $2`,
      [newId, orig.id]
    );

    await client.query('COMMIT');
    res.status(201).json(newPlan.rows[0]);
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
