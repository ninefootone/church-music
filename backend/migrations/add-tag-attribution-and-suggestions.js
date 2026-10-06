// Library tagging, round 2 (2026-10-06):
//  1. song_tags.added_by / added_at — who attached a tag and when (shown on /library-tagging).
//     Existing rows stay NULL ("unknown — before tracking").
//  2. song_tag_suggestions — suggested tags (first pass from Claude) waiting for a person to
//     accept or dismiss on /library-tagging. Never visible to churches.
//
// One transaction, idempotent, verifies its end state before COMMIT.
// Usage:
//   cd ~/church-music/backend && DATABASE_URL='…Railway URL…' node migrations/add-tag-attribution-and-suggestions.js

require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Pass it inline (see claude/running-backend-scripts.md).');
  process.exit(1);
}
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: isLocal ? false : { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE song_tags
        ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ
    `);
    // New rows get a timestamp automatically; old rows stay NULL (unknown).
    await client.query(`ALTER TABLE song_tags ALTER COLUMN added_at SET DEFAULT NOW()`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS song_tag_suggestions (
        song_id    UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        tag_id     UUID NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (song_id, tag_id)
      )
    `);

    // ── Verify end state ──
    const cols = await client.query(`
      SELECT column_name, column_default FROM information_schema.columns
       WHERE table_name = 'song_tags' AND column_name IN ('added_by', 'added_at')`);
    if (cols.rows.length !== 2) throw new Error('song_tags columns missing after migration');
    const tbl = await client.query(`SELECT to_regclass('public.song_tag_suggestions') AS t`);
    if (!tbl.rows[0].t) throw new Error('song_tag_suggestions table missing after migration');

    // Fire-test: insert + delete a song_tags row (fires the search-vector trigger) in a savepoint we roll back.
    const sample = await client.query(`
      SELECT s.id AS song_id, t.id AS tag_id FROM songs s CROSS JOIN tags t
       WHERE t.church_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM song_tags st WHERE st.song_id = s.id AND st.tag_id = t.id)
       LIMIT 1`);
    if (sample.rows.length) {
      const { song_id, tag_id } = sample.rows[0];
      await client.query('SAVEPOINT fire_test');
      const ins = await client.query(
        'INSERT INTO song_tags (song_id, tag_id) VALUES ($1, $2) RETURNING added_at', [song_id, tag_id]);
      if (!ins.rows[0].added_at) throw new Error('added_at default not applied');
      await client.query('INSERT INTO song_tag_suggestions (song_id, tag_id) VALUES ($1, $2)', [song_id, tag_id]);
      await client.query('ROLLBACK TO SAVEPOINT fire_test');
    }

    await client.query('COMMIT');
    console.log('✓ song_tags.added_by / added_at added');
    console.log('✓ song_tag_suggestions table ready');
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
