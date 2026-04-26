require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const seed = async () => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT DISTINCT ON (ccli_number)
        ccli_number, title, author, first_line, default_key, church_id
      FROM songs
      WHERE ccli_number IS NOT NULL
        AND ccli_number != ''
      ORDER BY ccli_number, created_at ASC
    `);

    console.log(`Found ${rows.length} songs with CCLI numbers`);

    let inserted = 0;
    for (const row of rows) {
      await client.query(`
        INSERT INTO ccli_lookup (ccli_number, title, author, first_line, default_key, source_church_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (ccli_number) DO NOTHING
      `, [row.ccli_number, row.title, row.author, row.first_line, row.default_key, row.church_id]);
      inserted++;
    }

    console.log(`Seeded ${inserted} entries into ccli_lookup`);
  } catch (err) {
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

seed();