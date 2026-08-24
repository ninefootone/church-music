require('dotenv').config();
const { Pool } = require('pg');
 
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 
// The complete, canonical global tag vocabulary (church_id IS NULL).
// Straight apostrophes only — curly apostrophes create silent duplicates.
// This list is the single source of truth for the shared vocabulary.
const GLOBAL_TAGS = [
  'Advent',
  'Christmas',
  'Easter',
  'Lent',
  'Funeral',
  'All-age',
  'Call to Worship',
  'Sending',
  'Communion',
  'Confession',
  'Lament',
  'Intercession',
  'Adoration',
  'Creation',
  'Faith & Trust',
  "God's Faithfulness",
  "God's Holiness",
  "God's Love",
  "God's Mercy",
  "God's Redemption",
  "God's Sovereignty",
  'Gospel Story',
  'Grace',
  "Eternity & Christ's Return",
  'Holy Spirit',
  'Hope',
  'Invitation',
  'Jesus',
  'Suffering & Comfort',
  'Life of Worship',
  'Mission & Evangelism',
  'Repentance',
  'Resurrection',
  'Salvation',
  'Scripture & The Word',
  'Testimony',
  'Thankfulness',
  'The Church',
  'The Cross',
  'Trinity',
];
 
const seed = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
 
    // Idempotent insert: only add a global tag that doesn't already exist.
    // Guards case-sensitively on the exact name; safe to re-run any time.
    const { rows } = await client.query(
      `
      INSERT INTO tags (church_id, name)
      SELECT NULL, t.name
      FROM unnest($1::text[]) AS t(name)
      WHERE NOT EXISTS (
        SELECT 1 FROM tags x
        WHERE x.church_id IS NULL AND x.name = t.name
      )
      RETURNING name
      `,
      [GLOBAL_TAGS]
    );
 
    await client.query('COMMIT');
 
    console.log(`Inserted ${rows.length} new global tag(s):`);
    rows.forEach((r) => console.log(`  + ${r.name}`));
    if (rows.length === 0) console.log('  (all tags already present — nothing to do)');
 
    // Verification: show the full current global vocabulary.
    const { rows: all } = await client.query(
      `SELECT name FROM tags WHERE church_id IS NULL ORDER BY name ASC`
    );
    console.log(`\nGlobal vocabulary now (${all.length} tags):`);
    all.forEach((r) => console.log(`  • ${r.name}`));
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