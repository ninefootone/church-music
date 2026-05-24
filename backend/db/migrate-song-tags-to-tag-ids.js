const pool = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Creating tags table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        UNIQUE(church_id, name)
      );
    `);

    console.log('Dropping old song_tags table...');
    await client.query(`DROP TABLE IF EXISTS song_tags;`);

    console.log('Creating new song_tags table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS song_tags (
        song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (song_id, tag_id)
      );
    `);

    await client.query('COMMIT');
    console.log('Done.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });