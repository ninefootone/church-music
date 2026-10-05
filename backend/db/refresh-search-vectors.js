require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE songs SET search_vector =
        setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(author, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(first_line, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(bible_references, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(notes, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(lyrics, '')), 'D')
    `);

    console.log(`✓ Refreshed search_vector for ${result.rowCount} songs`);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();