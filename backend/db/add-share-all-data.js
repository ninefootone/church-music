const pool = require('./pool');

async function migrate() {
  console.log('Adding share_all_data, copyright_info, copyright_link to songs...');
  await pool.query(`
    ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS share_all_data BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS copyright_info TEXT,
      ADD COLUMN IF NOT EXISTS copyright_link TEXT;
  `);
  console.log('Done.');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });