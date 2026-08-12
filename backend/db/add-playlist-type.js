const pool = require('./pool');

async function migrate() {
  console.log('Adding type column to church_playlists...');
  await pool.query(`
    ALTER TABLE church_playlists
      ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'other';
  `);
  console.log('Done.');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });