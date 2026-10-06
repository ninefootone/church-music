// Loads suggested tags from tagging-work/suggestions.json ({ "<song uuid>": ["Tag name", …] }) into
// song_tag_suggestions, for review on /library-tagging. Suggestions are NOT real tags — nothing
// changes for churches until someone accepts them on that page.
// - Only master-library songs and GLOBAL tags (matched by exact name); unknown names are reported.
// - Skips a suggestion when the song already carries that tag.
// - One transaction; ON CONFLICT DO NOTHING, so re-running is safe.
// Usage (dry run first — prints what it would do, writes nothing):
//   cd ~/church-music/backend && DATABASE_URL='…' MASTER_CHURCH_ID='…' node scripts/import-tag-suggestions.js --dry-run
//   cd ~/church-music/backend && DATABASE_URL='…' MASTER_CHURCH_ID='…' node scripts/import-tag-suggestions.js

require('dotenv').config({ path: '.env.import' });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL || !process.env.MASTER_CHURCH_ID) {
  console.error('DATABASE_URL and MASTER_CHURCH_ID must both be set inline (see claude/running-backend-scripts.md).');
  process.exit(1);
}
const dryRun = process.argv.includes('--dry-run');
const file = path.join(__dirname, '..', '..', 'tagging-work', 'suggestions.json');
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: isLocal ? false : { rejectUnauthorized: false } });

async function run() {
  const suggestions = JSON.parse(fs.readFileSync(file, 'utf8'));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tags = await client.query('SELECT id, name FROM tags WHERE church_id IS NULL');
    const tagId = new Map(tags.rows.map((t) => [t.name, t.id]));
    const songs = await client.query('SELECT id::text AS id FROM songs WHERE church_id = $1', [process.env.MASTER_CHURCH_ID]);
    const masterSongs = new Set(songs.rows.map((r) => r.id));

    let inserted = 0, alreadyTagged = 0, notMaster = 0;
    const unknownNames = new Set();
    for (const [songId, names] of Object.entries(suggestions)) {
      if (!masterSongs.has(songId)) { notMaster++; continue; }
      for (const name of names) {
        const id = tagId.get(name);
        if (!id) { unknownNames.add(name); continue; }
        const has = await client.query('SELECT 1 FROM song_tags WHERE song_id = $1 AND tag_id = $2', [songId, id]);
        if (has.rows.length) { alreadyTagged++; continue; }
        const r = await client.query(
          'INSERT INTO song_tag_suggestions (song_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [songId, id]);
        inserted += r.rowCount;
      }
    }

    if (dryRun) await client.query('ROLLBACK');
    else await client.query('COMMIT');
    console.log(`${dryRun ? 'DRY RUN — nothing saved. Would add' : '✓ Added'} ${inserted} suggestions across ${Object.keys(suggestions).length} songs`);
    console.log(`  skipped: ${alreadyTagged} already tagged, ${notMaster} songs not in the master library`);
    if (unknownNames.size) console.log(`  ⚠ unknown tag names (skipped): ${[...unknownNames].join(', ')}`);
    const total = await pool.query('SELECT COUNT(*)::int AS n, COUNT(DISTINCT song_id)::int AS songs FROM song_tag_suggestions');
    console.log(`  table now holds ${total.rows[0].n} suggestions on ${total.rows[0].songs} songs`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Import FAILED and was rolled back:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
