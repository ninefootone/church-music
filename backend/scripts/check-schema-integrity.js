// Read-only audit: verify that the "silent" parts of past migrations actually
// landed on the live DB — triggers, functions, unique/check constraints, indexes,
// and search-vector freshness. Missing columns aren't checked here: those throw
// loudly in the app, so they can't hide. This targets what fails quietly.
//
// Usage:
//   cd ~/church-music/backend && DATABASE_URL='…Railway URL…' node scripts/check-schema-integrity.js
 
require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');
 
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (single-quote it; put it right before node).');
  process.exit(1);
}
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
 
const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const tag = ok === true ? 'PASS' : ok === 'warn' ? 'WARN' : ok === 'fail' ? 'FAIL' : 'MISSING';
  console.log(`  [${tag}] ${name}${detail ? ' — ' + detail : ''}`);
}
 
async function q(text, params) { return (await pool.query(text, params)).rows; }
 
async function run() {
  try {
    console.log('\n=== Schema integrity audit (read-only) ===\n');
 
    // --- Triggers from add_full_text_search.js -----------------------------
    console.log('Full-text search triggers & functions:');
    const trigs = await q(`
      SELECT c.relname AS tbl, t.tgname
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE NOT t.tgisinternal AND c.relname IN ('songs','song_tags')
    `);
    const has = n => trigs.some(r => r.tgname === n);
    record("trigger songs_search_vector_trigger (keeps lyric/title search fresh on edit)",
      has('songs_search_vector_trigger'));
    record("trigger song_tags_search_vector_trigger (keeps tag search fresh)",
      has('song_tags_search_vector_trigger'));
 
    const fns = await q(`SELECT proname FROM pg_proc WHERE proname IN
      ('songs_search_vector_update','song_tags_search_vector_update')`);
    record("function songs_search_vector_update",   fns.some(r => r.proname === 'songs_search_vector_update'));
    record("function song_tags_search_vector_update", fns.some(r => r.proname === 'song_tags_search_vector_update'));

    // --- Trigger FIRE-TEST (the check that would have caught the 2026-09-07 500) ---
    // Presence ≠ execution. A function can exist AND be attached yet throw the moment
    // it fires — e.g. affected_song_id declared INTEGER while song_id is UUID, which
    // 500'd every tag save until fixed. So actually fire the song_tags trigger by
    // inserting then deleting one link, inside a transaction we ALWAYS roll back:
    // read-only in effect, but it exercises the exact path a song save takes.
    console.log('\nTrigger fire-test (runs the function, not just checks it exists):');
    const pair = await q(`
      SELECT s.id AS song_id, t.id AS tag_id
      FROM songs s CROSS JOIN tags t
      WHERE NOT EXISTS (SELECT 1 FROM song_tags st WHERE st.song_id = s.id AND st.tag_id = t.id)
      LIMIT 1`);
    if (!pair.length) {
      record("song_tags trigger fires without error", 'warn',
        'skipped — need ≥1 song and ≥1 tag with an unused (song,tag) combination to test');
    } else {
      const { song_id, tag_id } = pair[0];
      const client = await pool.connect();
      let fireErr = null;
      try {
        await client.query('BEGIN');
        // AFTER INSERT then AFTER DELETE on song_tags — the save path. A type-mismatched
        // function throws here (e.g. SQLSTATE 22P02, invalid input syntax for type ...).
        await client.query('INSERT INTO song_tags (song_id, tag_id) VALUES ($1, $2)', [song_id, tag_id]);
        await client.query('DELETE FROM song_tags WHERE song_id = $1 AND tag_id = $2', [song_id, tag_id]);
      } catch (e) {
        fireErr = e;
      } finally {
        await client.query('ROLLBACK').catch(() => {}); // always undo — nothing persists
        client.release();
      }
      record("song_tags trigger fires without error (INSERT+DELETE, rolled back)",
        fireErr ? 'fail' : true,
        fireErr ? `${fireErr.code || ''} ${fireErr.message}`.trim()
                : 'save path exercised, no persistence');
    }
 
    // --- Search-vector data health ----------------------------------------
    console.log('\nSearch-vector data:');
    const [{ n: nullSV }] = await q(`SELECT COUNT(*)::int n FROM songs WHERE search_vector IS NULL`);
    record("no songs with NULL search_vector", nullSV === 0, `${nullSV} NULL`);
    const [{ n: staleSV }] = await q(`
      SELECT COUNT(*)::int n FROM songs
      WHERE search_vector IS DISTINCT FROM (
        setweight(to_tsvector('english', coalesce(title,'')),'A') ||
        setweight(to_tsvector('english', coalesce(author,'')),'B') ||
        setweight(to_tsvector('english', coalesce(first_line,'')),'B') ||
        setweight(to_tsvector('english', coalesce(bible_references,'')),'C') ||
        setweight(to_tsvector('english', coalesce(notes,'')),'C') ||
        setweight(to_tsvector('english', coalesce(lyrics,'')),'D'))
    `);
    // Stale rows = trigger not firing on edits (or never backfilled). WARN, since
    // refresh-search-vectors.js fixes it — but a missing trigger will let it recur.
    record("stored search_vector matches recomputed (freshness)", staleSV === 0 ? true : 'warn',
      `${staleSV} stale — run refresh-search-vectors.js; if the songs trigger is MISSING above, that's why`);
    const [{ n: nullTV }] = await q(`
      SELECT COUNT(*)::int n FROM songs s
      WHERE EXISTS (SELECT 1 FROM song_tags st WHERE st.song_id=s.id)
        AND (s.tag_search_vector IS NULL OR s.tag_search_vector = to_tsvector('english',''))`);
    record("no tagged song with empty tag_search_vector", nullTV === 0, `${nullTV} empty`);
 
    // --- GIN indexes ------------------------------------------------------
    console.log('\nSearch indexes (GIN):');
    const gin = await q(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename='songs'
      AND indexdef ILIKE '%USING gin%'`);
    record("GIN index on search_vector",     gin.some(r => /search_vector/.test(r.indexdef) && !/tag_search_vector/.test(r.indexdef)), gin.map(r=>r.indexname).join(', ') || 'none');
    record("GIN index on tag_search_vector", gin.some(r => /tag_search_vector/.test(r.indexdef)));
 
    // --- Unique / check constraints from ALTER-style migrations -----------
    console.log('\nConstraints & unique indexes:');
    const [{ ok: tgu }] = await q(`SELECT COUNT(*)::int > 0 AS ok FROM pg_constraint WHERE conname='tags_global_name_unique'`);
    record("constraint tags_global_name_unique (migrate-global-tags.js)", tgu);
    const [{ ok: tcu }] = await q(`SELECT COUNT(*)::int > 0 AS ok FROM pg_indexes WHERE indexname='tags_church_lower_name_uniq'`);
    record("unique index tags_church_lower_name_uniq (add-church-tag-unique-index.js)", tcu);
 
    const plansCheck = await q(`SELECT pg_get_constraintdef(oid) def FROM pg_constraint
      WHERE conrelid='plans'::regclass AND contype='c'`);
    record("plans.status CHECK (draft/published) (add-plan-status.js)",
      plansCheck.some(r => /published/.test(r.def)),
      plansCheck.map(r => r.def).join(' | ') || 'no check constraints on plans');
 
    // member_unavailability may or may not exist as a table
    const mu = await q(`SELECT to_regclass('member_unavailability') AS t`);
    if (mu[0].t) {
      const muc = await q(`SELECT pg_get_constraintdef(oid) def FROM pg_constraint
        WHERE conrelid='member_unavailability'::regclass AND contype='c'`);
      record("member_unavailability end_date>=start_date CHECK (add-member-unavailability.js)",
        muc.some(r => /end_date/.test(r.def) && /start_date/.test(r.def)));
      const [{ ok: mui }] = await q(`SELECT COUNT(*)::int > 0 AS ok FROM pg_indexes WHERE indexname='idx_member_unavailability_lookup'`);
      record("index idx_member_unavailability_lookup", mui);
    } else {
      record("member_unavailability table present", 'warn', 'table not found — migration may not have run, or feature unused');
    }
 
    // --- Summary ----------------------------------------------------------
    const missing = results.filter(r => r.ok !== true && r.ok !== 'warn');
    const warns   = results.filter(r => r.ok === 'warn');
    console.log(`\n=== Summary: ${results.length - missing.length - warns.length} pass, ${warns.length} warn, ${missing.length} MISSING ===`);
    if (missing.length) {
      console.log('\nMISSING — needs attention:');
      for (const m of missing) console.log(`  - ${m.name}`);
      console.log('\nMost are re-created by re-running the owning migration (all should be idempotent).');
      console.log('A song_tags trigger that is present but FAILS the fire-test means the function body');
      console.log('itself throws (e.g. a type mismatch): fix the function source, then re-run');
      console.log('repair-tag-search.js so its CREATE OR REPLACE swaps the corrected function in live.');
    } else {
      console.log('\nNothing missing. The silent-failure surface is clean.');
    }
  } catch (err) {
    console.error('Audit failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}
run();
 

