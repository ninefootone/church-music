const pool = require('./pool');

async function migrate() {
  await pool.query(`
    ALTER TABLE memberships
      DROP COLUMN IF EXISTS default_role,
      ADD COLUMN IF NOT EXISTS default_roles TEXT[] NOT NULL DEFAULT '{}';
  `);
  console.log('Done: replaced default_role with default_roles TEXT[]');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });