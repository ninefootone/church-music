const pool = require('./pool');

async function migrate() {
  console.log('Creating member_unavailability table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_unavailability (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CHECK (end_date >= start_date)
    );

    CREATE INDEX IF NOT EXISTS idx_member_unavailability_lookup
      ON member_unavailability (church_id, user_id, start_date, end_date);
  `);
  console.log('Done.');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });