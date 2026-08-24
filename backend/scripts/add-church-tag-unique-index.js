// Load live-DB credentials the same way the other one-off scripts do.
// If your live DATABASE_URL lives in a different file, change the path below.
require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');
 
if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is not set. Check the env file this script loads (".env.import") ' +
    'exists in backend/ and contains DATABASE_URL, or run with an inline ' +
    'DATABASE_URL="..." prefix. Refusing to connect to localhost.'
  );
  process.exit(1);
}
 
const isLocal = /(?:localhost|127\.0\.0\.1|::1)/.test(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
 
// Case-insensitive uniqueness for a church's own tags. church_id is a real UUID
// for church tags, so this index enforces "no two tags in the same church whose
// names differ only by case/apostrophe/whitespace". Global tags (church_id IS NULL)
// are exempt (NULLs are distinct) and stay master-curated. Idempotent.
async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS tags_church_lower_name_uniq
      ON tags (church_id, lower(name));
    `);
    console.log('✓ Unique index tags_church_lower_name_uniq is in place.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}
 
main();