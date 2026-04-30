require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SOURCE_CHURCH_ID = 'b0c60082-789e-48c7-be6c-2237ea5a5c39';
const TARGET_CHURCH_ID = 'f418ca19-df63-47a1-8c2e-5eafe7b1a384';

const copy = async () => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT title, author, ccli_number, category
      FROM songs
      WHERE church_id = $1
        AND ccli_number IS NOT NULL
        AND ccli_number != ''
    `, [SOURCE_CHURCH_ID]);

    console.log(`Found ${rows.length} songs with CCLI numbers in source church`);

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const existing = await client.query(`
        SELECT id FROM songs
        WHERE church_id = $1
          AND ccli_number = $2
      `, [TARGET_CHURCH_ID, row.ccli_number]);

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      await client.query(`
        INSERT INTO songs (church_id, title, author, ccli_number, category)
        VALUES ($1, $2, $3, $4, $5)
      `, [TARGET_CHURCH_ID, row.title, row.author, row.ccli_number, row.category]);

      inserted++;
    }

    console.log(`Inserted: ${inserted}, Skipped (already exists): ${skipped}`);
  } catch (err) {
    console.error('Copy failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

copy();