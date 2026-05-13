const pool = require('../db/pool');

async function run() {
  await pool.query(`
    ALTER TABLE churches
    ADD COLUMN IF NOT EXISTS logo_url TEXT;
  `);
  console.log('Done: logo_url added to churches');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });