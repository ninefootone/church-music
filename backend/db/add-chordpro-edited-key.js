const pool = require('./pool');

async function migrate() {
  console.log('Adding edited_r2_key to song_files...');
  await pool.query(`
    ALTER TABLE song_files
      ADD COLUMN IF NOT EXISTS edited_r2_key TEXT;
  `);

  console.log('Done.');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });