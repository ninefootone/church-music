// READ-ONLY. Lists every church with its billing state, so you can see who is on
// the free plan (and so limited to 5 songs / 1 plan) vs paying vs lifetime free_access.
require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — aborting rather than falling back to localhost.');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    const { rows } = await pool.query(`
      SELECT c.name,
             CASE
               WHEN c.free_access THEN 'lifetime free_access'
               WHEN c.subscription_status IS NULL OR c.subscription_status = 'free' THEN 'FREE PLAN'
               ELSE c.subscription_status
             END AS plan,
             u.email AS owner,
             to_char(c.created_at, 'YYYY-MM-DD') AS created,
             (SELECT COUNT(*) FROM songs s WHERE s.church_id = c.id)::int AS songs,
             (SELECT COUNT(*) FROM plans p WHERE p.church_id = c.id)::int AS plans,
             (SELECT COUNT(*) FROM memberships m WHERE m.church_id = c.id AND m.role != 'revoked')::int AS members
      FROM churches c
      LEFT JOIN users u ON u.id = c.created_by
      ORDER BY plan, c.created_at DESC`);
    console.table(rows);
    const tally = rows.reduce((t, r) => ({ ...t, [r.plan]: (t[r.plan] || 0) + 1 }), {});
    console.log('Totals:', tally);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
