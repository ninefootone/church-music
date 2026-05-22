const pool = require('../db/pool');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Enable pg_trgm extension (needed for GIN trigram indexes)
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    console.log('✓ pg_trgm extension enabled');

    // 2. Add search_vector column for core song fields (weighted)
    //    A = title, B = author/first_line, C = bible_references/notes, D = lyrics
    //    This is a plain column (not generated) so we can update it from the trigger too
    await client.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS search_vector tsvector
    `);
    console.log('✓ search_vector column added');

    // 3. Populate search_vector for all existing songs
    await client.query(`
      UPDATE songs SET search_vector =
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(author, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(first_line, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(bible_references, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(notes, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(lyrics, '')), 'D')
    `);
    console.log('✓ search_vector populated for all existing songs');

    // 4. Create GIN index on search_vector
    await client.query(`
      CREATE INDEX IF NOT EXISTS songs_search_vector_idx
      ON songs USING GIN (search_vector)
    `);
    console.log('✓ GIN index created on search_vector');

    // 5. Create trigger function to keep search_vector up to date when a song is saved
    await client.query(`
      CREATE OR REPLACE FUNCTION songs_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(NEW.author, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(NEW.first_line, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(NEW.bible_references, '')), 'C') ||
          setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'C') ||
          setweight(to_tsvector('english', coalesce(NEW.lyrics, '')), 'D');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✓ songs_search_vector_update trigger function created');

    // 6. Attach trigger to songs table
    await client.query(`DROP TRIGGER IF EXISTS songs_search_vector_trigger ON songs`);
    await client.query(`
      CREATE TRIGGER songs_search_vector_trigger
      BEFORE INSERT OR UPDATE ON songs
      FOR EACH ROW EXECUTE FUNCTION songs_search_vector_update()
    `);
    console.log('✓ Trigger attached to songs table');

    // 7. Add tag_search_vector column — separate because tags live in a joined table
    await client.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS tag_search_vector tsvector
    `);
    console.log('✓ tag_search_vector column added');

    // 8. Populate tag_search_vector for all existing songs
    await client.query(`
      UPDATE songs s SET tag_search_vector = (
        SELECT to_tsvector('english', coalesce(string_agg(t.name, ' '), ''))
        FROM song_tags st
        JOIN tags t ON t.id = st.tag_id
        WHERE st.song_id = s.id
      )
    `);
    console.log('✓ tag_search_vector populated for all existing songs');

    // 9. Create GIN index on tag_search_vector
    await client.query(`
      CREATE INDEX IF NOT EXISTS songs_tag_search_vector_idx
      ON songs USING GIN (tag_search_vector)
    `);
    console.log('✓ GIN index created on tag_search_vector');

    // 10. Trigger function to update tag_search_vector when song_tags rows change
    await client.query(`
      CREATE OR REPLACE FUNCTION song_tags_search_vector_update() RETURNS trigger AS $$
      DECLARE
        affected_song_id INTEGER;
      BEGIN
        -- Works for INSERT, UPDATE, and DELETE
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
    console.log('✓ song_tags_search_vector_update trigger function created');

    // 11. Attach trigger to song_tags table
    await client.query(`DROP TRIGGER IF EXISTS song_tags_search_vector_trigger ON song_tags`);
    await client.query(`
      CREATE TRIGGER song_tags_search_vector_trigger
      AFTER INSERT OR UPDATE OR DELETE ON song_tags
      FOR EACH ROW EXECUTE FUNCTION song_tags_search_vector_update()
    `);
    console.log('✓ Trigger attached to song_tags table');

    await client.query('COMMIT');
    console.log('\n✅ Migration complete — full-text search is ready');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
