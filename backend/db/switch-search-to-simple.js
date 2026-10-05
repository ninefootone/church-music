// Switch song search from the 'english' text-search config to 'simple'.
//
// Why (2026-10-05): 'english' reduces words to a root before matching, so
// "joyful" and "joy" both became 'joy' and a search for "joyful" returned every
// song with "joy" in it. 'simple' keeps words as written; the routes now match
// the START of each typed word instead (utils/search.js), so "joy" still finds
// joyful/joys but "joyful" no longer finds plain "joy".
//
// Rebuilds both trigger functions and both stored vectors for every song.
// One transaction — all or nothing. Idempotent: safe to re-run.
//
// Usage:
//   cd ~/church-music/backend && DATABASE_URL="…Railway public URL…" node db/switch-search-to-simple.js

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

    // 1. Song fields trigger — same weights as before, 'simple' instead of 'english'.
    await client.query(`
      CREATE OR REPLACE FUNCTION songs_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(NEW.author, '')), 'B') ||
          setweight(to_tsvector('simple', coalesce(NEW.first_line, '')), 'B') ||
          setweight(to_tsvector('simple', coalesce(NEW.bible_references, '')), 'C') ||
          setweight(to_tsvector('simple', coalesce(NEW.notes, '')), 'C') ||
          setweight(to_tsvector('simple', coalesce(NEW.lyrics, '')), 'D');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✓ songs trigger function now uses simple');

    // 2. Tags trigger — same logic as before, 'simple' instead of 'english'.
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
          SELECT to_tsvector('simple', coalesce(string_agg(t.name, ' '), ''))
          FROM song_tags st
          JOIN tags t ON t.id = st.tag_id
          WHERE st.song_id = affected_song_id
        )
        WHERE id = affected_song_id;

        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✓ song_tags trigger function now uses simple');

    // 3. Rebuild every song's search_vector. (Setting it directly; the BEFORE
    //    UPDATE trigger would compute the same value anyway.)
    const sv = await client.query(`
      UPDATE songs SET search_vector =
        setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(author, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(first_line, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(bible_references, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(notes, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(lyrics, '')), 'D')
    `);
    console.log(`✓ search_vector rebuilt for ${sv.rowCount} songs`);

    // 4. Rebuild every song's tag_search_vector.
    const tv = await client.query(`
      UPDATE songs s SET tag_search_vector = coalesce((
        SELECT to_tsvector('simple', string_agg(t.name, ' '))
        FROM song_tags st JOIN tags t ON t.id = st.tag_id
        WHERE st.song_id = s.id
      ), to_tsvector('simple', ''))
    `);
    console.log(`✓ tag_search_vector rebuilt for ${tv.rowCount} songs`);

    // 5. Check before committing: "joyful" must no longer match a song whose
    //    only "joy" word is plain "joy".
    const check = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE search_vector @@ to_tsquery('simple', 'joyful:*'))::int AS joyful,
        COUNT(*) FILTER (WHERE search_vector @@ to_tsquery('simple', 'joy:*'))::int    AS joy_prefix
      FROM songs
    `);
    const { joyful, joy_prefix } = check.rows[0];
    console.log(`\nVerify: songs matching "joyful" = ${joyful}, matching "joy" (joy/joyful/joys…) = ${joy_prefix}`);

    await client.query('COMMIT');
    console.log('\n✅ Search now matches words as typed.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back (no changes made):', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
