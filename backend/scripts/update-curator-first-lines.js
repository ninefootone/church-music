require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SOURCE_CHURCH_ID = 'b0c60082-789e-48c7-be6c-2237ea5a5c39';
const TARGET_CHURCH_ID = 'f418ca19-df63-47a1-8c2e-5eafe7b1a384';

const update = async () => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT title, ccli_number, first_line
      FROM songs
      WHERE church_id = $1
        AND ccli_number IS NOT NULL
        AND ccli_number != ''
        AND first_line IS NOT NULL
        AND first_line != ''
    `, [SOURCE_CHURCH_ID]);

    console.log(`Found ${rows.length} songs with first lines in source church`);

    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const result = await client.query(`
        UPDATE songs
        SET first_line = $1
        WHERE church_id = $2
          AND ccli_number = $3
          AND (first_line IS NULL OR first_line = '')
      `, [row.first_line, TARGET_CHURCH_ID, row.ccli_number]);

      if (result.rowCount > 0) {
        updated++;
      } else {
        skipped++;
      }
    }

    console.log(`Updated: ${updated}, Skipped (already has first line): ${skipped}`);
  } catch (err) {
    console.error('Update failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

update();