// Multi-service plans (2026-10-24). See project doc multi-service-plans.md.
// plans.extra_times — additional start times for an IDENTICAL repeat of the plan (e.g. 9:15 plan
// also at 11:00). plan_start_time stays the first service. Service count = 1 + cardinality(extra_times).
// CCLI export + stats count each song once per service time (CCLI manual-reporting rule).
// Max 3 extra times (4 services). Empty array = single service (all existing plans).
//
// One transaction, idempotent, verifies its end state before COMMIT.
// Usage:
//   cd ~/church-music/backend && DATABASE_URL='…Railway URL…' node migrations/add-plan-extra-times.js

require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Pass it inline (see claude/running-backend-scripts.md).');
  process.exit(1);
}
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: isLocal ? false : { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE plans
        ADD COLUMN IF NOT EXISTS extra_times TIME[] NOT NULL DEFAULT '{}'
    `);
    await client.query(`ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_extra_times_max_check`);
    await client.query(`
      ALTER TABLE plans ADD CONSTRAINT plans_extra_times_max_check
        CHECK (cardinality(extra_times) <= 3)
    `);

    // ── Verify end state ──
    const col = await client.query(`
      SELECT data_type, is_nullable, column_default FROM information_schema.columns
       WHERE table_name = 'plans' AND column_name = 'extra_times'`);
    if (col.rows.length !== 1) throw new Error('plans.extra_times missing after migration');
    if (col.rows[0].data_type !== 'ARRAY' || col.rows[0].is_nullable !== 'NO') {
      throw new Error(`plans.extra_times has unexpected shape: ${JSON.stringify(col.rows[0])}`);
    }
    const con = await client.query(`SELECT 1 FROM pg_constraint WHERE conname = 'plans_extra_times_max_check'`);
    if (con.rows.length !== 1) throw new Error('plans_extra_times_max_check missing after migration');
    const nulls = await client.query(`SELECT COUNT(*)::int AS n FROM plans WHERE extra_times IS NULL`);
    if (nulls.rows[0].n !== 0) throw new Error('some plans have NULL extra_times');

    // Fire-test the constraint inside a savepoint (always rolled back).
    await client.query('SAVEPOINT firetest');
    let rejected = false;
    try {
      await client.query(`UPDATE plans SET extra_times = ARRAY['09:00','10:00','11:00','12:00']::time[]
                           WHERE id = (SELECT id FROM plans LIMIT 1)`);
    } catch (e) { rejected = true; }
    await client.query('ROLLBACK TO SAVEPOINT firetest');
    const anyPlan = await client.query('SELECT 1 FROM plans LIMIT 1');
    if (anyPlan.rows.length && !rejected) throw new Error('constraint did not reject 4 extra times');

    await client.query('COMMIT');
    const total = await client.query('SELECT COUNT(*)::int AS n FROM plans');
    console.log(`✓ plans.extra_times added (TIME[], default '{}', max 3). ${total.rows[0].n} plans verified as single-service.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('✗ Migration failed, rolled back:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
