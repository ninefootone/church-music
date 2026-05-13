const pool = require('../db/pool');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add link_type column to song_videos if it doesn't exist
    await client.query(`
      ALTER TABLE song_videos
      ADD COLUMN IF NOT EXISTS link_type VARCHAR(20) NOT NULL DEFAULT 'youtube'
    `);
    console.log('✓ link_type column added to song_videos');

    // 2. Migrate existing youtube_url values
    const songs = await client.query(`
      SELECT id, church_id, title, youtube_url
      FROM songs
      WHERE youtube_url IS NOT NULL AND youtube_url != ''
    `);
    console.log(`Found ${songs.rows.length} songs with youtube_url to migrate`);

    for (const song of songs.rows) {
      // Check if there's already a song_videos row for this song (avoid duplicates)
      const existing = await client.query(
        'SELECT id FROM song_videos WHERE song_id = $1',
        [song.id]
      );
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO song_videos (song_id, url, label, sort_order, link_type)
           VALUES ($1, $2, $3, 0, 'youtube')`,
          [song.id, song.youtube_url, 'YouTube reference video']
        );
        console.log(`  ✓ Migrated: ${song.title}`);
      } else {
        console.log(`  ⚠ Skipped (already has videos): ${song.title}`);
      }
    }

    // 3. We deliberately do NOT drop youtube_url yet — verify data first
    await client.query('COMMIT');
    console.log('\n✓ Migration complete. Verify data in Railway before dropping youtube_url column.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

run();