const pool = require('./pool');

async function migrate() {
  console.log('Adding can_annotate_plans to memberships...');
  await pool.query(`
    ALTER TABLE memberships
      ADD COLUMN IF NOT EXISTS can_annotate_plans BOOLEAN NOT NULL DEFAULT FALSE;
  `);
  console.log('Done.');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
