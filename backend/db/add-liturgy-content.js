
// Adds rich-text "content" to plan_items, and a per-church reusable
// snippet library (church_liturgy_snippets). Idempotent — safe to re-run.
//
// Run against the live DB (Railway needs SSL) with the connection string
// inline, per claude/running-backend-scripts.md:
//   cd ~/church-music/backend && DATABASE_URL="postgres://…" node db/add-liturgy-content.js
 
require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');
 
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Pass it inline, e.g.\n' +
    '  cd ~/church-music/backend && DATABASE_URL="postgres://…" node db/add-liturgy-content.js');
  process.exit(1);
}
 
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
 
async function migrate() {
  const client = await pool.connect();
  try {
    // 1. Rich-text body on non-song plan items (the Lord's Prayer text, etc.)
    await client.query(`
      ALTER TABLE plan_items
        ADD COLUMN IF NOT EXISTS content TEXT;
    `);
    console.log('  ✓ plan_items.content ready');
 
    // 2. Per-church reusable snippet library — mirrors the item's
    //    title/content/note so "Insert from library" can prefill all three.
    //    Follows the per-church categories/tags/plan-item-types pattern.
    await client.query(`
      CREATE TABLE IF NOT EXISTS church_liturgy_snippets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT,
        note TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  ✓ church_liturgy_snippets ready');
 
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_liturgy_snippets_church
        ON church_liturgy_snippets (church_id, sort_order);
    `);
    console.log('  ✓ index ready');
 
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}
 
migrate().catch(() => process.exit(1));