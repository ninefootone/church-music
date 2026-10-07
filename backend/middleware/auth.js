const { verifyToken, createClerkClient } = require('@clerk/backend');
const Sentry = require('../instrument');
const { isUuid } = require('../utils/ids');
const { sendWelcomeEmail } = require('../utils/email');

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Clerk token-verification failures that are OUR side's problem (Clerk unreachable, bad
// server config) rather than a bad token. Matched on `reason` because the error class
// exported from '@clerk/backend/errors' isn't the same object verifyToken throws.
const SERVER_SIDE_TOKEN_REASONS = new Set([
  'jwk-remote-failed-to-load',
  'secret-key-invalid',
  'jwk-failed-to-resolve',
  'jwk-local-missing',
]);

// 401 ONLY when the sign-in itself is bad (missing/expired/invalid token, or the Clerk user
// no longer exists). Anything else — database down, Clerk API down — is a 503: the web
// client treats 401 as "token expired, refresh and retry", so a 401 for an outage made it
// look like a sign-in problem.
const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorised' });

  let payload;
  try {
    payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
  } catch (err) {
    if (err && typeof err.reason === 'string' && !SERVER_SIDE_TOKEN_REASONS.has(err.reason)) {
      return res.status(401).json({ error: 'Unauthorised' });
    }
    return serviceUnavailable(res, err);
  }
  req.clerkUserId = payload.sub;

  let clerkUser;
  try {
    clerkUser = await clerkClient.users.getUser(payload.sub);
  } catch (err) {
    // Valid token but the account has since been deleted in Clerk.
    if (err && err.status === 404) return res.status(401).json({ error: 'Unauthorised' });
    return serviceUnavailable(res, err);
  }

  try {
    // Primary email, not simply the first one: accounts with Google + Apple (relay) addresses
    // have several, and [0] isn't necessarily the one the user chose.
    const primary = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId);
    const email = (primary || clerkUser.emailAddresses[0])?.emailAddress || '';
    const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
    const imageUrl = clerkUser.imageUrl || null;
    const pool = require('../db/pool');
    const user = await pool.query(
      // (xmax = 0) is true only when this statement INSERTED the row, i.e. a brand-new account.
      'INSERT INTO users (clerk_id, email, name, image_url) VALUES ($1, $2, $3, $4) ON CONFLICT (clerk_id) DO UPDATE SET email = $2, name = $3, image_url = $4 RETURNING *, (xmax = 0) AS inserted',
      [payload.sub, email, name, imageUrl]
    );
    const { inserted, ...row } = user.rows[0];
    req.user = row;
    if (inserted) {
      // New sign-up (web or iPad, free or paid): welcome email. Fire-and-forget — a Brevo
      // problem must never slow down or fail the sign-in itself.
      sendWelcomeEmail({ email, firstName: clerkUser.firstName || '' }).catch((err) => {
        console.warn('[welcome] email failed:', err.message);
        Sentry.captureException(err);
      });
    }
  } catch (err) {
    return serviceUnavailable(res, err);
  }
  next();
};

function serviceUnavailable(res, err) {
  console.error('Auth unavailable:', err && err.message);
  Sentry.captureException(err);
  return res.status(503).json({ error: 'SongStack is having trouble right now. Please try again in a moment.' });
}

const requireMembership = async (req, res, next) => {
  try {
    const pool = require('../db/pool');
    const churchId = req.headers['x-church-id'] || req.params.churchId || req.body?.churchId;
    if (!churchId) return res.status(400).json({ error: 'x-church-id header required' });
    if (!isUuid(churchId)) return res.status(400).json({ error: 'Invalid church id' });

    const membership = await pool.query(
      "SELECT * FROM memberships WHERE church_id = $1 AND user_id = $2 AND role != 'revoked'",
      [churchId, req.user.id]
    );
    if (membership.rows.length === 0) return res.status(403).json({ error: 'Church membership required' });

    req.churchId = churchId;
    req.membership = membership.rows[0];
    next();
  } catch (err) {
    next(err);
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    const pool = require('../db/pool');
    const churchId = req.headers['x-church-id'] || req.params.churchId || req.body?.churchId;
    if (!churchId) return res.status(400).json({ error: 'x-church-id header required' });
    if (!isUuid(churchId)) return res.status(400).json({ error: 'Invalid church id' });

    const membership = await pool.query(
      "SELECT * FROM memberships WHERE church_id = $1 AND user_id = $2 AND role = 'admin'",
      [churchId, req.user.id]
    );
    if (membership.rows.length === 0) return res.status(403).json({ error: 'Admin access required' });

    req.churchId = churchId;
    req.membership = membership.rows[0];
    next();
  } catch (err) {
    next(err);
  }
};

const requireChurchMember = requireMembership;
const requireChurchAdmin = requireAdmin;

const requirePermission = (flag) => async (req, res, next) => {
  try {
    const pool = require('../db/pool');
    const churchId = req.headers['x-church-id'] || req.params.churchId || req.body?.churchId;
    if (!churchId) return res.status(400).json({ error: 'x-church-id header required' });
    if (!isUuid(churchId)) return res.status(400).json({ error: 'Invalid church id' });

    const membership = await pool.query(
      "SELECT * FROM memberships WHERE church_id = $1 AND user_id = $2 AND role != 'revoked'",
      [churchId, req.user.id]
    );
    if (membership.rows.length === 0) return res.status(403).json({ error: 'Church membership required' });

    const m = membership.rows[0];
    req.churchId = churchId;
    req.membership = m;

    // Admins always pass
    if (m.role === 'admin') return next();

    // Members need the specific flag
    if (!m[flag]) {
      req.resume(); // drain any pending upload body so HTTP/2 returns the 403 instead of resetting the stream
      return res.status(403).json({ error: 'You don\'t have permission to do that' });
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireAuth, requireMembership, requireAdmin, requireChurchMember, requireChurchAdmin, requirePermission };
