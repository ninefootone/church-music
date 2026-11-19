// routes/guest.js — guest musician invite links (see claude/guest-mode.md).
//   GET  /api/guest/:token        — what the link is for (church, plan, name). No sign-in needed, so the landing
//                                   page can say "You've been invited to play at … on …" before sign-in.
//   POST /api/guest/:token/claim  — signed in: join the church as a guest (or, if already a member, just get linked
//                                   to the plan) and attach this account to the musician row. One use only.
// The token in the link is never stored — only its SHA-256 hash (plan_musicians.guest_token_hash).
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { hashGuestToken } = require('../utils/guestAccess');

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
const NOT_FOUND = { error: 'This invite link isn’t valid. Ask whoever sent it for a new one.' };

// Basic brake on guessing (tokens are 192-bit, so this is belt and braces): 30 lookups per IP per 15 minutes.
const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const h = (hits.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  h.push(now);
  hits.set(ip, h);
  if (hits.size > 5000) hits.clear();
  return h.length > 30;
}

async function findInvite(db, token, forUpdate) {
  const r = await db.query(
    `SELECT pm.id, pm.name, pm.role, pm.user_id, pm.guest_claimed_at, pm.guest_token_expires_at,
            p.id AS plan_id, p.title AS plan_title, p.plan_date, p.status AS plan_status,
            c.id AS church_id, c.name AS church_name, c.logo_url AS church_logo_url
       FROM plan_musicians pm
       JOIN plans p ON p.id = pm.plan_id
       JOIN churches c ON c.id = p.church_id
      WHERE pm.guest_token_hash = $1
      ${forUpdate ? 'FOR UPDATE OF pm' : ''}`,
    [hashGuestToken(token)]
  );
  return r.rows[0] || null;
}

const isExpired = (inv) => inv.guest_token_expires_at && new Date(inv.guest_token_expires_at) < new Date();

router.get('/:token', async (req, res, next) => {
  try {
    if (tooMany(req.ip)) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
    if (!TOKEN_RE.test(req.params.token)) return res.status(404).json(NOT_FOUND);
    const inv = await findInvite(pool, req.params.token, false);
    if (!inv) return res.status(404).json(NOT_FOUND);
    res.json({
      church_name: inv.church_name,
      church_logo_url: inv.church_logo_url,
      plan_title: inv.plan_title,
      plan_date: inv.plan_date,
      name: inv.name,
      role: inv.role,
      claimed: !!inv.guest_claimed_at,
      expired: isExpired(inv),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:token/claim', requireAuth, async (req, res, next) => {
  if (tooMany(req.ip)) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
  if (!TOKEN_RE.test(req.params.token)) return res.status(404).json(NOT_FOUND);
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const inv = await findInvite(client, req.params.token, true);
    if (!inv) { await client.query('ROLLBACK'); return res.status(404).json(NOT_FOUND); }

    const done = { church_id: inv.church_id, plan_id: inv.plan_id };
    if (inv.guest_claimed_at) {
      await client.query('ROLLBACK');
      // Same person opening their link again: fine, send them to the plan.
      if (inv.user_id === req.user.id) return res.json(done);
      return res.status(409).json({ error: 'This invite has already been used. Ask whoever sent it for a new link.' });
    }
    if (isExpired(inv)) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'This invite has expired. Ask whoever sent it for a new link.' });
    }

    const existing = await client.query(
      'SELECT role FROM memberships WHERE church_id = $1 AND user_id = $2 FOR UPDATE',
      [inv.church_id, req.user.id]
    );
    const current = existing.rows[0] && existing.rows[0].role;
    if (!current) {
      await client.query(
        `INSERT INTO memberships (church_id, user_id, role, can_manage_songs, can_add_plans, can_manage_playlists, can_annotate_plans)
         VALUES ($1, $2, 'guest', FALSE, FALSE, FALSE, FALSE)`,
        [inv.church_id, req.user.id]
      );
    } else if (current === 'revoked') {
      // Removed before, now invited back as a guest by someone who can edit this plan.
      await client.query(
        `UPDATE memberships SET role = 'guest', can_manage_songs = FALSE, can_add_plans = FALSE,
                can_manage_playlists = FALSE, can_annotate_plans = FALSE
          WHERE church_id = $1 AND user_id = $2`,
        [inv.church_id, req.user.id]
      );
    }
    // admin / member / guest already: keep their role, just link them to the plan.

    await client.query(
      'UPDATE plan_musicians SET user_id = $1, guest_claimed_at = NOW() WHERE id = $2',
      [req.user.id, inv.id]
    );
    await client.query('COMMIT');
    res.json(done);
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
