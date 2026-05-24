const pool = require('./pool');

async function migrate() {
  console.log('Adding default_duration to songs...');
  await pool.query(`
    ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS default_duration INTEGER;
  `);
  console.log('Done.');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });