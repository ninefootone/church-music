// Adds per-church plan templates ("default plans"): a saved time/title/
// pre-service notes + running order that a new plan can start from.
// Items are stored as a JSONB array (written and read whole; no song FKs —
// v1 templates hold service items and song slots only, never fixed songs).
// Idempotent — safe to re-run.
//
// Run against the live DB (Railway needs SSL) with the connection string
// inline, per claude/running-backend-scripts.md:
//   cd ~/church-music/backend && DATABASE_URL="postgres://…" node db/add-plan-templates.js

require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Pass it inline, e.g.\n' +
    '  cd ~/church-music/backend && DATABASE_URL="postgres://…" node db/add-plan-templates.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS plan_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        title TEXT,
        plan_time TEXT,
        plan_start_time TIME,
        plan_sort_order INTEGER NOT NULL DEFAULT 0,
        pre_service_notes TEXT,
        items JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  ✓ plan_templates ready');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_plan_templates_church
        ON plan_templates (church_id);
    `);
    console.log('  ✓ index ready');

    await client.query('COMMIT');
    console.log('Migration complete.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
