const pool = require('./pool');

async function migrate() {
  console.log('Creating church_playlists table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS church_playlists (
      id SERIAL PRIMARY KEY,
      church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log('Adding can_manage_playlists to memberships...');
  await pool.query(`
    ALTER TABLE memberships
      ADD COLUMN IF NOT EXISTS can_manage_playlists BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  console.log('Done.');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });