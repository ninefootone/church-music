// READ-ONLY. Lists any tag (global or church-owned) whose name contains "forgiv",
// with owning church and song count — run before adding "Forgiveness" to the
// global vocabulary, so church-made duplicates can be merged first.
//
// Usage:
//   cd ~/church-music/backend && DATABASE_URL='…Railway URL…' node scripts/check-forgiveness-tags.js

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be set inline (see claude/running-backend-scripts.md).');
  process.exit(1);
}
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: isLocal ? false : { rejectUnauthorized: false } });

async function run() {
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.name, t.church_id, c.name AS church_name,
              COUNT(st.song_id)::int AS song_count
         FROM tags t
         LEFT JOIN churches c ON c.id = t.church_id
         LEFT JOIN song_tags st ON st.tag_id = t.id
        WHERE t.name ILIKE '%forgiv%'
        GROUP BY t.id, c.name
        ORDER BY (t.church_id IS NOT NULL), lower(t.name)`
    );
    if (rows.length === 0) {
      console.log('✓ No tags containing "forgiv" anywhere — safe to add "Forgiveness" as a global tag.');
      return;
    }
    console.log(`Found ${rows.length} tag(s):`);
    for (const r of rows) {
      const scope = r.church_id ? `church: ${r.church_name || '(unnamed)'} [${r.church_id}]` : 'GLOBAL';
      console.log(`  "${r.name}" — ${scope} — ${r.song_count} song(s) — tag id ${r.id}`);
    }
  } catch (err) {
    console.error('Check failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();