// Merges the legacy per-church "plan item types" (title-only quick-add labels)
// into the unified church_liturgy_snippets library as title-only entries
// (content/note NULL). Idempotent — safe to re-run; skips any title a church
// already has as a snippet (case-insensitive).
//
// The church_plan_item_types table is deliberately LEFT IN PLACE (dormant) —
// dropping it is a separate, deliberate cleanup once we're confident.
//
// Run (per claude/running-backend-scripts.md):
//   cd ~/church-music/backend && DATABASE_URL="postgres://…" node db/merge-item-types-into-snippets.js

require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Pass it inline, e.g.\n' +
    '  cd ~/church-music/backend && DATABASE_URL="postgres://…" node db/merge-item-types-into-snippets.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  try {
    // Append each church's item types after its existing snippets, preserving
    // their order, skipping titles the church already has as a snippet.
    const { rowCount } = await client.query(`
      INSERT INTO church_liturgy_snippets (church_id, title, content, note, sort_order)
      SELECT
        it.church_id,
        it.name,
        NULL,
        NULL,
        COALESCE(base.max_sort, -1)
          + ROW_NUMBER() OVER (PARTITION BY it.church_id ORDER BY it.sort_order, it.name)
      FROM church_plan_item_types it
      LEFT JOIN (
        SELECT church_id, MAX(sort_order) AS max_sort
        FROM church_liturgy_snippets
        GROUP BY church_id
      ) base ON base.church_id = it.church_id
      WHERE NOT EXISTS (
        SELECT 1 FROM church_liturgy_snippets s
        WHERE s.church_id = it.church_id
          AND lower(s.title) = lower(it.name)
      );
    `);

    console.log(`Migrated ${rowCount} item type(s) into church_liturgy_snippets.`);

    const { rows } = await client.query(`
      SELECT COUNT(*) FILTER (WHERE content IS NULL) AS title_only,
             COUNT(*) FILTER (WHERE content IS NOT NULL) AS with_content,
             COUNT(*) AS total
      FROM church_liturgy_snippets;
    `);
    const r = rows[0];
    console.log(`Snippet library now: ${r.total} total (${r.title_only} title-only, ${r.with_content} with content).`);
    console.log('Migration complete. (church_plan_item_types left in place, dormant.)');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));