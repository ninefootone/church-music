require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE songs
        ADD COLUMN IF NOT EXISTS in_discover BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS discover_description TEXT,
        ADD COLUMN IF NOT EXISTS discover_image_key TEXT;
    `);
    console.log('Migration complete: in_discover, discover_description, discover_image_key added to songs');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

migrate();