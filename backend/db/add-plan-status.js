const pool = require('./pool');

async function migrate() {
  await pool.query(`
    ALTER TABLE plans
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
        CHECK (status IN ('draft', 'published'));
  `);

  // can_edit_any_plan column stays in DB (non-destructive) but we stop using it.
  // No data to change — all existing plans default to 'published'.

  console.log('Migration complete: plans.status added');
  await pool.end();
}

migrate().catch(err => { console.error(err); process.exit(1); });