const pool = require('../db/pool');

async function migrate() {
  await pool.query(`
    ALTER TABLE churches
    ADD COLUMN IF NOT EXISTS free_access BOOLEAN NOT NULL DEFAULT FALSE;
  `);
  console.log('free_access column added to churches');
  process.exit(0);
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});