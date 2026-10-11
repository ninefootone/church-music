// Song rights + Discover-only favourites (2026-10-11). See project doc song-rights-and-discover-only.md.
//  1. songs.rights_status — research result for the SONG (words + tune), master library only:
//       public_domain | pd_words | mm_owned | partner | copyright | unknown   (NULL = not assessed)
//     songs.rights_note   — why (writers' death dates, tune, arrangement).
//     songs.files_cleared — the library owner has opened this song's files and confirmed they are
//       safe to give away free. This is the ONLY thing that lets a file be downloaded on the
//       churchless Discover-only page (/browse). Research alone never sets it.
//  2. user_favourite_songs — per-USER (not per-church) favourites from /browse, so they survive
//     the user later creating or joining a church.
//
// One transaction, idempotent, verifies its end state before COMMIT.
// Usage:
//   cd ~/church-music/backend && DATABASE_URL='…Railway URL…' node migrations/add-song-rights-and-favourites.js

require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Pass it inline (see claude/running-backend-scripts.md).');
  process.exit(1);
}
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: isLocal ? false : { rejectUnauthorized: false } });

const STATUSES = ['public_domain', 'pd_words', 'mm_owned', 'partner', 'copyright', 'unknown'];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE songs
        ADD COLUMN IF NOT EXISTS rights_status TEXT,
        ADD COLUMN IF NOT EXISTS rights_note   TEXT,
        ADD COLUMN IF NOT EXISTS files_cleared BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await client.query(`ALTER TABLE songs DROP CONSTRAINT IF EXISTS songs_rights_status_check`);
    await client.query(`
      ALTER TABLE songs ADD CONSTRAINT songs_rights_status_check
        CHECK (rights_status IS NULL OR rights_status IN (${STATUSES.map((s) => `'${s}'`).join(', ')}))
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_favourite_songs (
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        song_id    UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, song_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS user_favourite_songs_song_idx ON user_favourite_songs (song_id)`);

    // ── Verify end state ──
    const cols = await client.query(`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'songs' AND column_name IN ('rights_status', 'rights_note', 'files_cleared')`);
    if (cols.rows.length !== 3) throw new Error('songs rights columns missing after migration');
    const tbl = await client.query(`SELECT to_regclass('public.user_favourite_songs') AS t`);
    if (!tbl.rows[0].t) throw new Error('user_favourite_songs table missing after migration');

    // Fire-test in a savepoint we roll back: the CHECK must accept a valid value and reject a bad one,
    // and the songs search/update triggers must still run with the new columns.
    const sample = await client.query('SELECT id FROM songs LIMIT 1');
    if (sample.rows.length) {
      const id = sample.rows[0].id;
      await client.query('SAVEPOINT fire_test');
      await client.query(`UPDATE songs SET rights_status = 'public_domain', files_cleared = true WHERE id = $1`, [id]);
      let rejected = false;
      await client.query('SAVEPOINT bad_value');
      try {
        await client.query(`UPDATE songs SET rights_status = 'nonsense' WHERE id = $1`, [id]);
      } catch {
        rejected = true;
        await client.query('ROLLBACK TO SAVEPOINT bad_value');
      }
      if (!rejected) throw new Error('rights_status CHECK constraint did not reject a bad value');
      const u = await client.query('SELECT id FROM users LIMIT 1');
      if (u.rows.length) {
        await client.query('INSERT INTO user_favourite_songs (user_id, song_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [u.rows[0].id, id]);
      }
      await client.query('ROLLBACK TO SAVEPOINT fire_test');
    }

    await client.query('COMMIT');
    console.log('✓ songs.rights_status / rights_note / files_cleared added');
    console.log('✓ user_favourite_songs table ready');
    console.log('✓ fire-test passed (rolled back — nothing changed)');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration FAILED and was rolled back:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
