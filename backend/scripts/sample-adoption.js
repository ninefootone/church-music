// READ-ONLY. For churches created since sample content launched, shows whether they went
// beyond the samples: own songs, own plans, sample items kept/deleted, members.
// Usage: DATABASE_URL='…' node scripts/sample-adoption.js [since YYYY-MM-DD, default 2026-10-08]
require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — aborting rather than falling back to localhost.');
  process.exit(1);
}
const since = process.argv[2] || '2026-10-08';
if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) { console.error('Date must be YYYY-MM-DD'); process.exit(1); }
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    const { rows } = await pool.query(`
      SELECT c.name,
             to_char(c.created_at, 'YYYY-MM-DD') AS created,
             CASE WHEN c.free_access THEN 'free_access'
                  WHEN c.subscription_status IS NULL OR c.subscription_status IN ('free','canceled') THEN 'free'
                  ELSE c.subscription_status END AS plan,
             (SELECT COUNT(*) FROM songs s WHERE s.church_id = c.id AND NOT s.is_sample)::int AS own_songs,
             (SELECT COUNT(*) FROM plans p WHERE p.church_id = c.id AND NOT p.is_sample)::int AS own_plans,
             (SELECT COUNT(*) FROM songs s WHERE s.church_id = c.id AND s.is_sample)::int AS samples_left,
             (SELECT COUNT(*) FROM memberships m WHERE m.church_id = c.id AND m.role != 'revoked')::int AS members
      FROM churches c
      WHERE c.created_at >= $1::date
      ORDER BY c.created_at`, [since]);
    console.table(rows);
    const n = rows.length;
    const active = rows.filter(r => r.own_songs > 0 || r.own_plans > 0).length;
    console.log(`${n} church(es) since ${since}; ${active} added their own songs or plans (${n ? Math.round(100 * active / n) : 0}%).`);
    console.log('Remember to ignore your own test churches.');
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
