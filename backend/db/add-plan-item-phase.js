const pool = require('./pool');

async function migrate() {
  console.log('Adding phase column to plan_items...');
  await pool.query(`
    ALTER TABLE plan_items
      ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'service';
  `);
  console.log('Done.');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });