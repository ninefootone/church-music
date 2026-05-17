const express = require('express');
const router = express.Router();
const { sendBrevoEmail } = require('../utils/email');
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
const { requireAuth, requireMembership, requireAdmin, requirePermission } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

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
    const result = await pool.query(
      `SELECT p.id, p.plan_date, p.plan_time, p.title,
              STRING_AGG(pm.role, ', ' ORDER BY pm.role) AS musician_roles
       FROM plans p
       JOIN plan_musicians pm ON pm.plan_id = p.id
       WHERE p.church_id = $1
         AND pm.user_id = $2
         AND p.plan_date >= CURRENT_DATE
       GROUP BY p.id, p.plan_date, p.plan_time, p.title
       ORDER BY p.plan_date ASC, p.plan_time ASC
       LIMIT 10`,
      [req.churchId, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/musicians', async function(req, res, next) {
  try {
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
      `SELECT si.id, si.type, si.phase, si.title, si.notes, si.key_override, si.position,
        si.custom_arrangement, si.duration_minutes,
        s.id AS song_id, s.title AS song_title, s.author AS song_author,
        s.default_key AS song_default_key, s.category AS song_category,
        s.ccli_number AS song_ccli_number,
        s.suggested_arrangement AS song_suggested_arrangement,
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
    const plan = await pool.query(
      'SELECT * FROM plans WHERE public_token = $1',
      [req.params.token]
    );
    if (plan.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const items = await pool.query(
      `SELECT si.type, si.phase, si.title, si.notes, si.key_override, si.position,
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

    res.json(Object.assign({}, plan.rows[0], { items: items.rows }));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requirePermission('can_add_plans'), async function(req, res, next) {
  try {
    const churchId = req.churchId;

    // Free tier gate — max 1 plan
    const church = await pool.query('SELECT subscription_status FROM churches WHERE id = $1', [churchId]);
    const status = church.rows[0]?.subscription_status;
    if (!status || status === 'free') {
      const count = await pool.query('SELECT COUNT(*) FROM plans WHERE church_id = $1', [churchId]);
      if (parseInt(count.rows[0].count) >= 1) {
        return res.status(403).json({ error: 'You have reached the 1 plan limit on the free plan. Upgrade in Settings to add more.' });
      }
    }

    const plan_date = req.body.plan_date;
    const plan_time = req.body.plan_time;
    const plan_start_time = req.body.plan_start_time || null;
    const plan_sort_order = req.body.plan_sort_order ?? 0;
    const title = req.body.title;
    const public_token = uuidv4().split('-')[0];

    const plan = await pool.query(
      'INSERT INTO plans (church_id, plan_date, plan_time, plan_start_time, plan_sort_order, title, public_token, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [churchId, plan_date, plan_time, plan_start_time, plan_sort_order, title, public_token, req.user.clerk_id]
    );
    res.status(201).json(plan.rows[0]);
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
    const plan_date = req.body.plan_date;
    const plan_time = req.body.plan_time;
    const plan_start_time = req.body.plan_start_time || null;
    const plan_sort_order = req.body.plan_sort_order ?? 0;
    const title = req.body.title;
    const status = ['draft', 'published'].includes(req.body.status) ? req.body.status : undefined;
    const plan = await pool.query(
      `UPDATE plans SET plan_date=$1, plan_time=$2, plan_start_time=$3, plan_sort_order=$4, title=$5${status ? ', status=$8' : ''} WHERE id=$6 AND church_id=$7 RETURNING *`,
      status
        ? [plan_date, plan_time, plan_start_time, plan_sort_order, title, req.params.id, req.churchId, status]
        : [plan_date, plan_time, plan_start_time, plan_sort_order, title, req.params.id, req.churchId]
    );
    if (plan.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(plan.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/items', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const items = req.body.items;
    const planId = req.params.id;

    await pool.query('DELETE FROM plan_items WHERE plan_id = $1', [planId]);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await pool.query(
        'INSERT INTO plan_items (plan_id, type, song_id, title, notes, key_override, position, custom_arrangement, duration_minutes, phase) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [planId, item.type, item.song_id || null, item.title || null, item.notes || null, item.key_override || null, i, item.custom_arrangement || null, item.duration_minutes ? parseInt(item.duration_minutes) : null, item.phase || 'service']
      );
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/items/:itemId/notes — update notes only (annotators + full editors)
router.patch('/:id/items/:itemId/notes', requireAuth, requireMembership, async function(req, res, next) {
  try {
    const { notes } = req.body;
    const { id: planId, itemId } = req.params;
    const isAdmin = req.membership.role === 'admin';
    const canEditAny = req.membership.can_edit_any_plan;
    const canAnnotate = req.membership.can_annotate_plans;

    // Check plan belongs to this church
    const plan = await pool.query(
      'SELECT created_by FROM plans WHERE id=$1 AND church_id=$2',
      [planId, req.churchId]
    );
    if (plan.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const isOwner = plan.rows[0].created_by === req.user.clerk_id;
    if (!isAdmin && !isOwner && !canEditAny && !canAnnotate) {
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
    console.log('[musicians POST] body:', req.body, 'planId:', req.params.id);
    if (!name || !role) return res.status(400).json({ error: 'name and role are required' });
    const result = await pool.query(
      `INSERT INTO plan_musicians (plan_id, user_id, name, role)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, user_id || null, name, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[musicians POST] error:', err.message, err.stack);
    next(err);
  }
});

router.delete('/:id/musicians/:musicianId', requireAuth, requireMembership, async function(req, res, next) {
  try {
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
  const { recipients } = req.body // array of { email, name }

  if (!recipients || recipients.length === 0) {
    return res.status(400).json({ error: 'No recipients provided' })
  }

  try {
    // Fetch plan
    const planResult = await pool.query(
      'SELECT p.*, c.name AS church_name FROM plans p JOIN churches c ON c.id = p.church_id WHERE p.id = $1 AND p.church_id = $2',
      [planId, churchId]
    )
    if (planResult.rows.length === 0) return res.status(404).json({ error: 'Plan not found' })
    const plan = planResult.rows[0]

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

    // Build song rows HTML
    const itemsHtml = items.map((item, i) => {
      if (item.type !== 'song') {
        const label = item.title || (item.type.charAt(0).toUpperCase() + item.type.slice(1))
        return `<tr><td colspan="3" style="padding:10px 16px;background:#f8f9fa;font-size:13px;color:#666;font-style:italic;border-bottom:1px solid #e5e7eb;">${label}</td></tr>`
      }
      const title = item.song_title || 'Untitled'
      const key = item.key_override || item.song_default_key || ''
      const keyBadge = key ? `<span style="display:inline-block;padding:2px 8px;background:#dbeafe;color:#1e40af;border-radius:4px;font-size:11px;font-weight:600;margin-left:6px;">${key}</span>` : ''
      const arrangement = item.custom_arrangement || ''
      const arrangementHtml = arrangement ? `<div style="font-size:12px;color:#6b7280;margin-top:3px;">${arrangement}</div>` : ''
      const files = filesBySongId[item.song_id] || []
      const fileLinks = files.map(f => {
        const label = [f.label, f.key_of].filter(Boolean).join(' — ')
        return `<a href="${f.signedUrl}" style="display:inline-block;margin-right:6px;margin-top:4px;padding:3px 10px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:4px;font-size:11px;color:#1d4ed8;text-decoration:none;">${label}</a>`
      }).join('')
      return `<tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px 16px;width:28px;color:#9ca3af;font-size:13px;">${i + 1}</td>
        <td style="padding:10px 16px;">
          <div style="font-size:15px;font-weight:600;color:#111827;">${title}${keyBadge}</div>
          ${arrangementHtml}
          ${fileLinks ? `<div style="margin-top:4px;">${fileLinks}</div>` : ''}
        </td>
        <td style="padding:10px 16px;font-size:13px;color:#6b7280;">${item.song_category ? item.song_category.replace(/_/g, '-').replace(/\b\w/g, c => c.toUpperCase()) : ''}</td>
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
          `<tr><td style="padding:6px 16px;font-size:14px;color:#111827;">${name}</td><td style="padding:6px 16px;font-size:13px;color:#6b7280;">${roles.join(', ')}</td></tr>`
        ).join('')
      : `<tr><td colspan="2" style="padding:10px 16px;font-size:13px;color:#9ca3af;font-style:italic;">No musicians listed</td></tr>`

    const planTitle = plan.title ? ` — ${plan.title}` : ''
    const planTime = plan.plan_time ? `<p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">${plan.plan_time}</p>` : ''
    const publicUrl = `${process.env.FRONTEND_URL || 'https://songstack.church'}/s/${plan.public_token}`

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    
    <div style="background:#4b7fa5;padding:24px 32px;">
      <p style="margin:0;color:rgba(255,255,255,0.8);font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">${plan.church_name}</p>
      <h1 style="margin:4px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Plan${planTitle}</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:16px;">${planDate}</p>
      ${planTime}
    </div>

    <div style="padding:24px 0;">
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
    res.status(500).json({ error: 'Failed to send email' })
  }
})

router.post('/:id/duplicate', requireAuth, requirePermission('can_add_plans'), async function(req, res, next) {
  try {
    const source = await pool.query(
      'SELECT * FROM plans WHERE id=$1 AND church_id=$2',
      [req.params.id, req.churchId]
    );
    if (source.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });

    const orig = source.rows[0];
    const { plan_date, plan_time, plan_start_time, plan_sort_order, title } = req.body;
    const public_token = uuidv4().split('-')[0];

    const newPlan = await pool.query(
      `INSERT INTO plans (church_id, plan_date, plan_time, plan_start_time, plan_sort_order, title, public_token, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft') RETURNING *`,
      [req.churchId, plan_date, plan_time, plan_start_time ?? orig.plan_start_time, plan_sort_order ?? orig.plan_sort_order, title ?? orig.title, public_token, req.user.clerk_id]
    );
    const newId = newPlan.rows[0].id;

    // Copy plan items
    const items = await pool.query(
      'SELECT * FROM plan_items WHERE plan_id=$1 ORDER BY position',
      [orig.id]
    );
    for (const item of items.rows) {
      await pool.query(
        `INSERT INTO plan_items (plan_id, type, title, notes, song_id, key_override, position, custom_arrangement, duration_minutes, phase)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [newId, item.type, item.title, item.notes, item.song_id, item.key_override, item.position, item.custom_arrangement, item.duration_minutes, item.phase || 'service']
      );
    }

    // Copy musicians
    const musicians = await pool.query(
      'SELECT * FROM plan_musicians WHERE plan_id=$1',
      [orig.id]
    );
    for (const m of musicians.rows) {
      await pool.query(
        `INSERT INTO plan_musicians (plan_id, name, role, user_id) VALUES ($1,$2,$3,$4)`,
        [newId, m.name, m.role, m.user_id]
      );
    }

    res.status(201).json(newPlan.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
