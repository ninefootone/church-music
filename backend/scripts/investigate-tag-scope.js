// investigate-tag-scope.js — READ ONLY. Changes nothing.
//
// Settles whether the "import creates duplicate tags" bug is real-but-latent or
// non-existent. The deciding fact: are the tags on master library/discover songs
// stored as GLOBAL (shared default list, church_id IS NULL) or as tags OWNED by
// the master account (church_id = the master church)?
//   - all global      → bug is real; it just hasn't fired (no tagged import yet)
//   - all church-owned → import's copy behaviour is correct; nothing to fix
//
// Run:
//   cd ~/church-music/backend && DATABASE_URL="postgresql://…Railway URL…" node scripts/investigate-tag-scope.js
 
const { Pool } = require('pg');
 
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Pass it inline:\n  DATABASE_URL="postgresql://…" node scripts/investigate-tag-scope.js');
  process.exit(1);
}
 
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
 
async function main() {
  // 1. Which church owns the library/discover songs (this is the master library).
  const masters = await pool.query(`
    SELECT s.church_id,
           COALESCE(c.name, '(unknown)') AS name,
           COUNT(*) FILTER (WHERE s.in_library)  AS library_songs,
           COUNT(*) FILTER (WHERE s.in_discover) AS discover_songs
    FROM songs s
    LEFT JOIN churches c ON c.id = s.church_id
    WHERE s.in_library = true OR s.in_discover = true
    GROUP BY s.church_id, c.name
    ORDER BY library_songs DESC
  `);
 
  // 2. THE CRUX — scope of tags actually applied to master library/discover songs.
  const scope = await pool.query(`
    SELECT
      CASE WHEN t.church_id IS NULL
           THEN 'global (shared default list)'
           ELSE 'church-owned (private to an account)' END AS scope,
      COUNT(DISTINCT t.id) AS distinct_tags,
      COUNT(*)             AS tag_links
    FROM songs s
    JOIN song_tags st ON st.song_id = s.id
    JOIN tags t       ON t.id = st.tag_id
    WHERE s.in_library = true OR s.in_discover = true
    GROUP BY 1
    ORDER BY 1
  `);
 
  // 3. Church-owned tags per account (excludes globals) — shows whether any
  //    non-master church has accumulated its own tags at all (e.g. via imports).
  const byChurch = await pool.query(`
    SELECT COALESCE(c.name, '(unknown)') AS name,
           t.church_id,
           COUNT(*) AS own_tags
    FROM tags t
    LEFT JOIN churches c ON c.id = t.church_id
    WHERE t.church_id IS NOT NULL
    GROUP BY c.name, t.church_id
    ORDER BY own_tags DESC
  `);
 
  console.log('\n=== 1. Master library account(s) — churches owning library/discover songs ===\n');
  for (const r of masters.rows) {
    console.log(`  ${r.name}  [${r.church_id}]  — ${r.library_songs} library, ${r.discover_songs} discover songs`);
  }
 
  console.log('\n=== 2. CRUX — tag scope on master library/discover songs ===\n');
  if (scope.rows.length === 0) {
    console.log('  (no tags applied to any library/discover song)');
  } else {
    for (const r of scope.rows) {
      console.log(`  ${r.scope.padEnd(42)} ${r.distinct_tags} distinct tags, ${r.tag_links} links`);
    }
  }
 
  console.log('\n=== 3. Church-owned tags per account (globals excluded) ===\n');
  if (byChurch.rows.length === 0) {
    console.log('  (no church-owned tags exist anywhere — only the shared global list is in use)');
  } else {
    for (const r of byChurch.rows) {
      console.log(`  ${r.name.padEnd(30)} ${r.own_tags} own tags`);
    }
  }
  console.log('');
 
  await pool.end();
}
 
main().catch(err => {
  console.error('Investigation failed:', err.message);
  pool.end();
  process.exit(1);
});