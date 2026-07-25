require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE plans
        ADD COLUMN IF NOT EXISTS plan_start_time TIME;

      ALTER TABLE plan_items
        ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

      ALTER TABLE songs
        ADD COLUMN IF NOT EXISTS default_duration INTEGER;
    `);
    console.log('Migration complete: plan_start_time, duration_minutes, default_duration added');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

migrate();