require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const update = async () => {
  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(`
      UPDATE ccli_lookup cl
      SET category = s.category
      FROM (
        SELECT DISTINCT ON (ccli_number) ccli_number, category
        FROM songs
        WHERE ccli_number IS NOT NULL
          AND ccli_number != ''
          AND category IS NOT NULL
        ORDER BY ccli_number, created_at ASC
      ) s
      WHERE cl.ccli_number = s.ccli_number
        AND (cl.category IS NULL OR cl.category = '')
    `);
    console.log(`Updated ${rowCount} ccli_lookup entries with category`);
  } catch (err) {
    console.error('Update failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

update();