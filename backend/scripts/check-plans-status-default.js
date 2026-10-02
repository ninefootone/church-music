// Read-only: what does the LIVE database actually say about plans.status?
// add-plan-status.js intended DEFAULT 'published' + CHECK (draft|published), but
// there's no record of what ran. Also prints plan_items' live columns/constraints
// (input for deciding what to do with the stale db/migrate.js, now db/history/migrate.js).
//
// Runs inside a READ ONLY transaction, so it cannot change anything.
//
// Usage:
//   cd ~/church-music/backend && DATABASE_URL='…Railway URL…' node scripts/check-plans-status-default.js

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

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');

    const col = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'status'`);
    console.log('\n== plans.status column ==');
    console.table(col.rows);

    const checks = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'public.plans'::regclass AND contype = 'c'`);
    console.log('== CHECK constraints on plans ==');
    console.table(checks.rows);

    const counts = await client.query(`SELECT status, COUNT(*)::int AS plans FROM plans GROUP BY status ORDER BY status`);
    console.log('== plans by status ==');
    console.table(counts.rows);

    const items = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'plan_items'
      ORDER BY ordinal_position`);
    console.log('== plan_items columns (live) ==');
    console.table(items.rows);

    const itemCons = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'public.plan_items'::regclass
      ORDER BY contype, conname`);
    console.log('== plan_items constraints (live) ==');
    console.table(itemCons.rows);

    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
