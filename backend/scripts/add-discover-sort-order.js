require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE songs
        ADD COLUMN IF NOT EXISTS discover_sort_order INTEGER;
    `);
    console.log('Migration complete: discover_sort_order added to songs');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

migrate();