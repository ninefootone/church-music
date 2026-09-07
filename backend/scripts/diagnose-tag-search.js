// Read-only diagnostic for tag free-text search.
// Usage:
//   cd ~/church-music/backend && DATABASE_URL="postgresql://…Railway URL…" node scripts/diagnose-tag-search.js Adoration
// Pass the tag word you're testing as the first arg (defaults to "Adoration").
 
require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');
 
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Pass it inline (see claude/running-backend-scripts.md).');
  process.exit(1);
}
 
const term = process.argv[2] || 'Adoration';
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
 
async function run() {
  const q = (text, params) => pool.query(text, params);
  try {
    console.log(`\n=== Diagnosing tag search for term: "${term}" ===\n`);
 
    // 1. Column present?
    const col = await q(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name='songs' AND column_name='tag_search_vector'
    `);
    console.log(`1. tag_search_vector column exists: ${col.rowCount > 0 ? 'YES' : 'NO  <-- migration never ran'}`);
 
    // 2. Trigger on song_tags present?
    const trig = await q(`
      SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'song_tags'::regclass AND NOT tgisinternal
    `);
    const hasTrig = trig.rows.some(r => r.tgname === 'song_tags_search_vector_trigger');
    console.log(`2. song_tags trigger attached: ${hasTrig ? 'YES' : 'NO  <-- newly-tagged songs never get indexed'}`);
    if (trig.rowCount) console.log(`   (triggers found: ${trig.rows.map(r => r.tgname).join(', ')})`);
 
    if (col.rowCount === 0) { console.log('\nColumn is missing — run the migration. Stopping.'); return; }
 
    // 3. Songs that HAVE tags but a NULL/empty vector = the smoking gun for a missed backfill.
    const stale = await q(`
      SELECT COUNT(*)::int AS n
      FROM songs s
      WHERE EXISTS (SELECT 1 FROM song_tags st WHERE st.song_id = s.id)
        AND (s.tag_search_vector IS NULL OR s.tag_search_vector = to_tsvector('english',''))
    `);
    console.log(`3. Songs that have tags but an empty tag_search_vector: ${stale.rows[0].n}` +
      (stale.rows[0].n > 0 ? '  <-- these will never match a tag search' : ''));
 
    // 4. The specific song(s) tagged with the term — show stored vector + whether it matches.
    const songs = await q(`
      SELECT s.id, s.title,
             s.tag_search_vector::text AS vec,
             (s.tag_search_vector @@ plainto_tsquery('english', $1)) AS matches,
             (SELECT string_agg(t.name, ', ') FROM song_tags st JOIN tags t ON t.id=st.tag_id WHERE st.song_id=s.id) AS tag_names
      FROM songs s
      WHERE EXISTS (
        SELECT 1 FROM song_tags st JOIN tags t ON t.id=st.tag_id
        WHERE st.song_id=s.id AND lower(t.name)=lower($1)
      )
      ORDER BY s.title
      LIMIT 20
    `, [term]);
    console.log(`\n4. Songs carrying a tag named "${term}": ${songs.rowCount}`);
    for (const r of songs.rows) {
      console.log(`   - [${r.id}] "${r.title}"`);
      console.log(`       tags: ${r.tag_names}`);
      console.log(`       stored vector: ${r.vec || '(NULL)'}`);
      console.log(`       matches plainto_tsquery('english','${term}'): ${r.matches}`);
    }
 
    // 5. Sanity: what does the query itself return for this search term?
    const hit = await q(`
      SELECT COUNT(*)::int AS n FROM songs s
      WHERE s.tag_search_vector @@ plainto_tsquery('english', $1)
    `, [term]);
    console.log(`\n5. Total songs whose tag vector matches "${term}": ${hit.rows[0].n}`);
 
    console.log('\n=== Verdict ===');
    if (!hasTrig) console.log('- Trigger missing: attach it (migration step 11) or tags stay unindexed going forward.');
    if (stale.rows[0].n > 0 || songs.rows.some(r => !r.matches)) {
      console.log('- Backfill needed: tag_search_vector was never populated for some/all tagged songs.');
      console.log('  Fix (safe, idempotent) — rebuild every song\'s tag vector from its tags:');
      console.log(`    UPDATE songs s SET tag_search_vector = COALESCE((`);
      console.log(`      SELECT to_tsvector('english', string_agg(t.name, ' '))`);
      console.log(`      FROM song_tags st JOIN tags t ON t.id=st.tag_id WHERE st.song_id=s.id`);
      console.log(`    ), to_tsvector('english',''));`);
    }
    if (hasTrig && stale.rows[0].n === 0 && songs.rows.every(r => r.matches) && songs.rowCount > 0) {
      console.log('- Data looks correct. If search still fails, the problem is upstream of the DB');
      console.log('  (which church_id the request carries, or the search string reaching the API).');
    }
  } catch (err) {
    console.error('Diagnostic failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}
 
run();
 