// Repair tag free-text search: attach the missing song_tags trigger AND backfill
// tag_search_vector for every song. Idempotent — safe to re-run.
//
// Root cause (confirmed 2026-09-07 via diagnose-tag-search.js): the tag portion of
// migrations/add_full_text_search.js was only partially applied on production — the
// column existed but the trigger (step 11) was never attached and the vectors were
// never populated, so all 32 tagged songs had NULL tag_search_vector and no tag
// search ever matched.
//
// Usage:
//   cd ~/church-music/backend && DATABASE_URL="…Railway URL…" node scripts/repair-tag-search.js
 
require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');
 
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Pass it inline (see claude/running-backend-scripts.md).');
  process.exit(1);
}
 
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
 
async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
 
    // 1. (Re)create the trigger function — mirrors migration step 10 exactly.
    await client.query(`
      CREATE OR REPLACE FUNCTION song_tags_search_vector_update() RETURNS trigger AS $$
      DECLARE
        affected_song_id UUID;
      BEGIN
        IF TG_OP = 'DELETE' THEN
          affected_song_id := OLD.song_id;
        ELSE
          affected_song_id := NEW.song_id;
        END IF;
 
        UPDATE songs SET tag_search_vector = (
          SELECT to_tsvector('english', coalesce(string_agg(t.name, ' '), ''))
          FROM song_tags st
          JOIN tags t ON t.id = st.tag_id
          WHERE st.song_id = affected_song_id
        )
        WHERE id = affected_song_id;
 
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✓ trigger function ensured');
 
    // 2. Attach the trigger (idempotent via DROP IF EXISTS) — mirrors migration step 11.
    await client.query(`DROP TRIGGER IF EXISTS song_tags_search_vector_trigger ON song_tags`);
    await client.query(`
      CREATE TRIGGER song_tags_search_vector_trigger
      AFTER INSERT OR UPDATE OR DELETE ON song_tags
      FOR EACH ROW EXECUTE FUNCTION song_tags_search_vector_update()
    `);
    console.log('✓ trigger attached to song_tags');
 
    // 3. Backfill every song's tag vector from its current tags.
    const upd = await client.query(`
      UPDATE songs s SET tag_search_vector = coalesce((
        SELECT to_tsvector('english', string_agg(t.name, ' '))
        FROM song_tags st JOIN tags t ON t.id = st.tag_id
        WHERE st.song_id = s.id
      ), to_tsvector('english', ''))
    `);
    console.log(`✓ tag_search_vector backfilled for ${upd.rowCount} songs`);
 
    // 4. Verify inside the same transaction before committing.
    const check = await client.query(`
      SELECT COUNT(*)::int AS n FROM songs
      WHERE tag_search_vector @@ plainto_tsquery('english', 'Adoration')
    `);
    const stale = await client.query(`
      SELECT COUNT(*)::int AS n FROM songs s
      WHERE EXISTS (SELECT 1 FROM song_tags st WHERE st.song_id = s.id)
        AND (s.tag_search_vector IS NULL OR s.tag_search_vector = to_tsvector('english',''))
    `);
    console.log(`\nVerify: songs matching tag search "Adoration" = ${check.rows[0].n} (was 0)`);
    console.log(`Verify: tagged songs still with an empty vector = ${stale.rows[0].n} (should be 0)`);
 
    if (stale.rows[0].n !== 0) {
      throw new Error('Some tagged songs still have an empty vector — rolling back, do not commit.');
    }
 
    await client.query('COMMIT');
    console.log('\n✅ Repair committed. Tag free-text search is live and self-maintaining.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Repair failed, rolled back (no changes made):', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}
 
run();
 