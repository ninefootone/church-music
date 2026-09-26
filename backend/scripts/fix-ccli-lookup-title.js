require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — aborting.');
  process.exit(1);
}

const CCLI_NUMBER = '7055737'; // Where, O Grave, Is Your Victory?

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const run = async () => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT title, author, first_line, default_key FROM songs WHERE ccli_number = $1 ORDER BY updated_at DESC LIMIT 1`,
      [CCLI_NUMBER]
    );
    if (rows.length === 0) throw new Error('No song found with that CCLI number');
    const src = rows[0];
    const result = await client.query(
      `UPDATE ccli_lookup SET title = $1, author = $2, first_line = $3, default_key = $4, updated_at = NOW()
       WHERE ccli_number = $5 RETURNING title`,
      [src.title, src.author, src.first_line, src.default_key, CCLI_NUMBER]
    );
    console.log('ccli_lookup row now reads:', result.rows[0]?.title);
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch(err => { console.error('Fix failed:', err); process.exit(1); });