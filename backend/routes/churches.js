const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const generateInviteCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const generateShortId = () => Math.random().toString(36).substring(2, 6);

// Create a church
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, ccli_number } = req.body;
    if (!name) return res.status(400).json({ error: 'Church name required' });

    // Append short random ID to slug to avoid collisions
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const slug = `${baseSlug}-${generateShortId()}`
    const invite_code = generateInviteCode();

    const church = await pool.query(
      'INSERT INTO churches (name, slug, invite_code, created_by, ccli_number) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, slug, invite_code, req.user.id, ccli_number || null]
    );

    await pool.query(
      'INSERT INTO memberships (church_id, user_id, role) VALUES ($1, $2, $3)',
      [church.rows[0].id, req.user.id, 'admin']
    );

    res.status(201).json(church.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Join a church by invite code
router.post('/join', requireAuth, async (req, res, next) => {
  try {
    const { invite_code } = req.body;
    const church = await pool.query('SELECT * FROM churches WHERE invite_code = $1', [invite_code]);
    if (church.rows.length === 0) return res.status(404).json({ error: 'Invalid invite code — please check and try again' });

    const existing = await pool.query(
      'SELECT * FROM memberships WHERE church_id = $1 AND user_id = $2',
      [church.rows[0].id, req.user.id]
    );
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
      const { sendBrevoEmail } = require('../utils/email')
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
          await sendBrevoEmail({
            to: admin.email,
            toName: adminName,
            subject: `New member joined ${church.rows[0].name}`,
            htmlContent: `<p>Hi ${adminName},</p><p><strong>${memberName}</strong> (${m.email}) has just joined <strong>${church.rows[0].name}</strong> on Song Stack.</p><p>You can view and manage your team from your <a href="https://app.songstack.church/dashboard">dashboard</a>.</p><p>— Song Stack</p>`
          })
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
      `SELECT c.*, m.role FROM churches c
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

// Remove a member (admin only)
router.delete('/:churchId/members/:memberId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { churchId, memberId } = req.params
    await pool.query(
      'UPDATE memberships SET role = $1 WHERE church_id = $2 AND user_id = $3',
      ['revoked', churchId, memberId]
    )
    res.json({ message: 'Member removed' })
  } catch (err) {
    next(err)
  }
})

// Get church details
router.get('/:churchId', requireAuth, async (req, res, next) => {
  try {
    const church = await pool.query('SELECT * FROM churches WHERE id = $1', [req.params.churchId]);
    if (church.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(church.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update church settings (admin only)
router.patch('/:churchId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, ccli_number } = req.body;
    const church = await pool.query(
      'UPDATE churches SET name = COALESCE($1, name), ccli_number = $2 WHERE id = $3 RETURNING *',
      [name || null, ccli_number || null, req.params.churchId]
    );
    if (church.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(church.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Regenerate invite code (admin only)
router.post('/:churchId/regenerate-invite', requireAuth, async (req, res, next) => {
  try {
    const invite_code = generateInviteCode();
    const church = await pool.query(
      'UPDATE churches SET invite_code = $1 WHERE id = $2 RETURNING *',
      [invite_code, req.params.churchId]
    );
    res.json(church.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
