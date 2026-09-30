// Read-only diagnostic: do master-library / Discover songs actually have tag rows?
// Answers whether "tags don't import" is a data gap (source songs untagged) or a code bug.
// Safe to run repeatedly — SELECT only, no writes.
require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is unset — set it inline or in .env.import');
  process.exit(1);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const master = process.env.MASTER_CHURCH_ID;
  if (!master) { console.error('MASTER_CHURCH_ID is unset'); process.exit(1); }

  // Songs the import route treats as importable from the master library
  const totals = await pool.query(
    `SELECT
       COUNT(*) AS total_songs,
       COUNT(*) FILTER (WHERE in_discover = true) AS discover_songs,
       COUNT(*) FILTER (WHERE share_all_data = true) AS share_all_songs
     FROM songs WHERE church_id = $1`,
    [master]
  );

  // How many of those songs have at least one tag row
  const tagged = await pool.query(
    `SELECT
       COUNT(DISTINCT s.id) AS songs_with_tags,
       COUNT(st.tag_id)     AS total_tag_links
     FROM songs s
     JOIN song_tags st ON st.song_id = s.id
     WHERE s.church_id = $1`,
    [master]
  );

  // A sample of Discover songs and their tag counts
  const sample = await pool.query(
    `SELECT s.title,
            s.share_all_data,
            COUNT(st.tag_id) AS tag_count
     FROM songs s
     LEFT JOIN song_tags st ON st.song_id = s.id
     WHERE s.church_id = $1 AND s.in_discover = true
     GROUP BY s.id, s.title, s.share_all_data
     ORDER BY tag_count DESC, s.title
     LIMIT 15`,
    [master]
  );

  console.log('--- Master library song counts ---');
  console.table(totals.rows);
  console.log('--- Songs carrying tag rows ---');
  console.table(tagged.rows);
  console.log('--- Sample Discover songs (tag_count) ---');
  console.table(sample.rows);

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });