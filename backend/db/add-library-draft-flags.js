const pool = require('./pool');

async function migrate() {
  console.log('Adding is_draft and in_library flags to songs...');
  await pool.query(`
    ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS in_library BOOLEAN DEFAULT FALSE;
  `);
  console.log('Done.');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });