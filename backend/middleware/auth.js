const { createClerkClient } = require('@clerk/backend');

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorised' });

    const payload = await clerk.verifyToken(token, {
      authorizedParties: [
        process.env.FRONTEND_URL,
        'http://localhost:3000',
      ].filter(Boolean),
    });

    req.clerkUserId = payload.sub;

    const pool = require('../db/pool');
    let user = await pool.query('SELECT * FROM users WHERE clerk_id = $1', [payload.sub]);

    if (user.rows.length === 0) {
      const clerkUser = await clerk.users.getUser(payload.sub);
      const email = clerkUser.emailAddresses[0]?.emailAddress || '';
      const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
      user = await pool.query(
        'INSERT INTO users (clerk_id, email, name) VALUES ($1, $2, $3) ON CONFLICT (clerk_id) DO UPDATE SET email = $2, name = $3 RETURNING *',
        [payload.sub, email, name]
      );
    }

    req.user = user.rows[0];
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(401).json({ error: 'Unauthorised' });
  }
};

const requireMembership = async (req, res, next) => {
  try {
    const pool = require('../db/pool');
    const churchId = req.headers['x-church-id'] || req.params.churchId || req.body.churchId;
    if (!churchId) return res.status(400).json({ error: 'x-church-id header required' });

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
    const churchId = req.headers['x-church-id'] || req.params.churchId || req.body.churchId;
    if (!churchId) return res.status(400).json({ error: 'x-church-id header required' });

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

module.exports = { requireAuth, requireMembership, requireAdmin, requireChurchMember, requireChurchAdmin };
