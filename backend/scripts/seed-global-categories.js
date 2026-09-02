// Seeds the global category vocabulary (church_id IS NULL). Idempotent — safe to
// re-run. Load live DB the same way the other scripts do; override with an inline
// DATABASE_URL="..." prefix if your creds live elsewhere.
require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');
 
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — run with an inline DATABASE_URL="..." prefix.');
  process.exit(1);
}
 
const isLocal = /(?:localhost|127\.0\.0\.1|::1)/.test(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
 
// value = the text stored in songs.category (unchanged existing data); label = display.
const GLOBAL_CATEGORIES = [
  { value: 'praise',    label: 'Praise' },
  { value: 'assurance', label: 'Assurance' },
  { value: 'response',  label: 'Response' },
  { value: 'other',     label: 'Other' },
];
 
const seed = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
 
    const inserted = [];
    for (const { value, label } of GLOBAL_CATEGORIES) {
      const { rows } = await client.query(
        `INSERT INTO categories (church_id, value, label)
         SELECT NULL, $1, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM categories WHERE church_id IS NULL AND value = $1
         )
         RETURNING value`,
        [value, label]
      );
      if (rows.length) inserted.push(value);
    }
 
    await client.query('COMMIT');
 
    console.log(`Inserted ${inserted.length} new global categor${inserted.length === 1 ? 'y' : 'ies'}:`);
    inserted.forEach(v => console.log(`  + ${v}`));
    if (inserted.length === 0) console.log('  (all already present — nothing to do)');
 
    const { rows: all } = await client.query(
      `SELECT value, label FROM categories WHERE church_id IS NULL ORDER BY label ASC`
    );
    console.log(`\nGlobal categories now (${all.length}):`);
    all.forEach(r => console.log(`  • ${r.label}  (${r.value})`));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error — rolled back:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};
 
seed();