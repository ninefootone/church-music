// audit-duplicate-tags.js — READ ONLY. Changes nothing.
//
// Finds church-owned tags that duplicate a shared/default (global) tag by name.
// These are created by the song-import route, which mints a church-owned tag
// instead of reusing the existing global one. Reports how many exist, which
// churches are affected, and how many song links point at a duplicate.
//
// Run (per running-backend-scripts.md):
//   cd ~/church-music/backend && DATABASE_URL="postgresql://…Railway URL…" node scripts/audit-duplicate-tags.js
 
const { Pool } = require('pg');
 
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Pass it inline, e.g.\n  DATABASE_URL="postgresql://…" node scripts/audit-duplicate-tags.js');
  process.exit(1);
}
 
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
 
async function main() {
  // Every church-owned tag whose name matches a global (default-list) tag,
  // with the number of songs linked to the church-owned copy.
  const { rows } = await pool.query(`
    SELECT
      ct.church_id,
      COALESCE(c.name, '(unknown church)') AS church_name,
      ct.name                              AS tag_name,
      gt.id                                AS global_tag_id,
      ct.id                                AS church_tag_id,
      COUNT(DISTINCT st.song_id)           AS songs_using_church_copy
    FROM tags ct
    JOIN tags gt
      ON gt.church_id IS NULL
     AND lower(gt.name) = lower(ct.name)
    LEFT JOIN churches c   ON c.id = ct.church_id
    LEFT JOIN song_tags st ON st.tag_id = ct.id
    WHERE ct.church_id IS NOT NULL
    GROUP BY ct.church_id, c.name, ct.name, gt.id, ct.id
    ORDER BY church_name, tag_name
  `);
 
  if (rows.length === 0) {
    console.log('\n✅ No duplicate tags found. Every church-owned tag has a distinct name from the default list.\n');
    await pool.end();
    return;
  }
 
  const churches = new Set(rows.map(r => r.church_id));
  const totalLinks = rows.reduce((n, r) => n + Number(r.songs_using_church_copy), 0);
  const emptyDupes = rows.filter(r => Number(r.songs_using_church_copy) === 0).length;
 
  console.log('\n=== Duplicate tags: church-owned copies of default-list tags ===\n');
  console.log(`Duplicate tag rows        : ${rows.length}`);
  console.log(`Churches affected         : ${churches.size}`);
  console.log(`Song links on duplicates  : ${totalLinks}   (these would be repointed to the default tag in a cleanup)`);
  console.log(`Duplicate rows with 0 songs: ${emptyDupes}   (pure clutter — safe to just delete)\n`);
 
  console.log('Per-church detail:\n');
  let currentChurch = null;
  for (const r of rows) {
    if (r.church_name !== currentChurch) {
      currentChurch = r.church_name;
      console.log(`  ${r.church_name}`);
    }
    console.log(`      • "${r.tag_name}"  — ${r.songs_using_church_copy} song(s) on the church copy`);
  }
  console.log('');
 
  await pool.end();
}
 
main().catch(err => {
  console.error('Audit failed:', err.message);
  pool.end();
  process.exit(1);
});