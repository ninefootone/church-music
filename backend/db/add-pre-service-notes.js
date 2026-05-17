const pool = require('./pool');

async function migrate() {
  console.log('Adding pre_service_notes to plans...');
  await pool.query(`
    ALTER TABLE plans
      ADD COLUMN IF NOT EXISTS pre_service_notes TEXT;
  `);
  console.log('Done.');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });