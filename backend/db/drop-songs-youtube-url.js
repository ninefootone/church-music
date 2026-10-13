// Drops the legacy songs.youtube_url column. Song links have lived in song_videos
// since backend/scripts/migrate-youtube-to-links.js (May 2026); nothing reads or
// writes youtube_url any more (removed from routes/songs.js, types, import script
// on 2026-10-13). The public share page was still reading it until 2026-10-13.
//
// Two modes:
//   node db/drop-songs-youtube-url.js           → REPORT ONLY. Changes nothing.
//   node db/drop-songs-youtube-url.js --apply   → backs the values up into
//        songs_youtube_url_backup (song_id, youtube_url), then drops the column.
//        All-or-nothing; safe to re-run.
//
// It does NOT copy old youtube_url values into song_videos: a value that isn't
// in song_videos may be a link someone deliberately deleted from Links, and
// copying it back would resurrect it. The report lists those so they can be
// checked by hand; the backup table keeps them recoverable.
//
// Run only AFTER the code that stopped writing youtube_url is deployed on Railway.
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — refusing to run.');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    const col = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'songs' AND column_name = 'youtube_url'`);
    if (col.rows.length === 0) {
      console.log('✓ songs.youtube_url is already gone — nothing to do.');
      return;
    }

    const totals = await client.query(`
      SELECT COUNT(*) AS with_value FROM songs
      WHERE youtube_url IS NOT NULL AND youtube_url <> ''`);
    console.log(`Songs with a youtube_url value: ${totals.rows[0].with_value}`);

    // Values that are NOT already one of that song's links.
    const orphans = await client.query(`
      SELECT s.id, s.title, c.name AS church, s.youtube_url
      FROM songs s
      LEFT JOIN churches c ON c.id = s.church_id
      WHERE s.youtube_url IS NOT NULL AND s.youtube_url <> ''
        AND NOT EXISTS (SELECT 1 FROM song_videos v WHERE v.song_id = s.id AND v.url = s.youtube_url)
      ORDER BY c.name, s.title`);
    console.log(`…of which NOT in that song's Links: ${orphans.rows.length}`);
    if (orphans.rows.length) {
      console.table(orphans.rows.slice(0, 50).map(r => ({ church: r.church, song: r.title, youtube_url: r.youtube_url })));
      if (orphans.rows.length > 50) console.log(`(first 50 of ${orphans.rows.length} shown)`);
    }

    if (!APPLY) {
      console.log('\nREPORT ONLY — nothing changed. Re-run with --apply to back up and drop the column.');
      return;
    }

    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS songs_youtube_url_backup (
        song_id UUID PRIMARY KEY,
        youtube_url TEXT NOT NULL,
        backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    const saved = await client.query(`
      INSERT INTO songs_youtube_url_backup (song_id, youtube_url)
      SELECT id, youtube_url FROM songs
      WHERE youtube_url IS NOT NULL AND youtube_url <> ''
      ON CONFLICT (song_id) DO UPDATE SET youtube_url = EXCLUDED.youtube_url`);
    await client.query('ALTER TABLE songs DROP COLUMN youtube_url');
    await client.query('COMMIT');

    // Verify the end state, not just "no error".
    const after = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM information_schema.columns
           WHERE table_name = 'songs' AND column_name = 'youtube_url') AS column_left,
        (SELECT COUNT(*) FROM songs_youtube_url_backup) AS backed_up`);
    console.log(`Backed up ${saved.rowCount} value(s).`, after.rows[0]);
    if (Number(after.rows[0].column_left) !== 0) throw new Error('youtube_url column still exists');
    console.log('✓ songs.youtube_url dropped (values kept in songs_youtube_url_backup)');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed, rolled back:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
