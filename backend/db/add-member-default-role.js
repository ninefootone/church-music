const pool = require('./pool');

async function migrate() {
  await pool.query(`
    ALTER TABLE memberships
      ADD COLUMN IF NOT EXISTS default_role TEXT;
  `);
  console.log('Done: added default_role to memberships');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });