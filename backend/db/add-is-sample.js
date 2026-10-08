// Adds is_sample to songs and plans. Sample content is seeded into every new
// church and does NOT count towards the free-plan limits (5 songs / 1 plan).
// Idempotent and all-or-nothing: safe to re-run.
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — refusing to run.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_sample BOOLEAN NOT NULL DEFAULT FALSE');
    await client.query('ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_sample BOOLEAN NOT NULL DEFAULT FALSE');
    await client.query('COMMIT');

    // Verify the end state, not just "no error".
    const check = await client.query(`
      SELECT table_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE column_name = 'is_sample' AND table_name IN ('songs', 'plans')
      ORDER BY table_name`);
    console.table(check.rows);
    if (check.rows.length !== 2) throw new Error('Expected is_sample on both songs and plans');

    const counts = await client.query(`
      SELECT (SELECT COUNT(*) FROM songs WHERE is_sample) AS sample_songs,
             (SELECT COUNT(*) FROM plans WHERE is_sample) AS sample_plans`);
    console.log('Existing sample rows (should be 0 and 0):', counts.rows[0]);
    console.log('✓ is_sample migration complete');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed, rolled back:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
