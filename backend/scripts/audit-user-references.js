// Read-only audit: everything in the LIVE database that points at a user.
// Needed before writing account deletion, because the repo's migrate.js and the
// live schema have drifted (e.g. plans.created_by is compared to a clerk_id in
// the code, but migrate.js declares it as a UUID FK to users).
//
// Usage:
//   cd ~/church-music/backend && DATABASE_URL='…Railway URL…' node scripts/audit-user-references.js
// Expect: two tables of output, no writes. Paste the whole output back to Claude.

require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (single-quote it; put it right before node).');
  process.exit(1);
}
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

async function run() {
  try {
    console.log('\n=== 1. Foreign keys that reference users (and what happens on DELETE) ===\n');
    const fks = await pool.query(`
      SELECT c.conrelid::regclass AS tbl,
             a.attname            AS col,
             CASE c.confdeltype WHEN 'a' THEN 'NO ACTION (blocks delete)'
                                WHEN 'r' THEN 'RESTRICT (blocks delete)'
                                WHEN 'c' THEN 'CASCADE'
                                WHEN 'n' THEN 'SET NULL'
                                WHEN 'd' THEN 'SET DEFAULT' END AS on_delete
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f' AND c.confrelid = 'users'::regclass
      ORDER BY 1, 2`);
    console.table(fks.rows);

    console.log('\n=== 2. Columns that MIGHT hold a person (no FK needed to leak data) ===\n');
    const cols = await pool.query(`
      SELECT table_name AS tbl, column_name AS col, data_type AS type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name ~* '(user|created_by|updated_by|clerk|email|owner|author|assigned|member|invited|name$)'
        AND table_name NOT IN ('songs','ccli_lookup')
      ORDER BY 1, 2`);
    console.table(cols.rows);

    console.log('\n=== 3. users table shape ===\n');
    const ucols = await pool.query(`
      SELECT column_name AS col, data_type AS type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`);
    console.table(ucols.rows);
  } catch (e) {
    console.error('Audit failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
run();
