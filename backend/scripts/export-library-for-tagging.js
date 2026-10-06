// READ-ONLY. Exports every non-retired master-library song (title, author, lyrics as plain text,
// current global tags) to tagging-work/export.json so Claude can suggest tags.
// tagging-work/ is gitignored — it contains lyrics, which must never be committed.
//
// Usage:
//   cd ~/church-music/backend && DATABASE_URL='…Railway URL…' MASTER_CHURCH_ID='…' node scripts/export-library-for-tagging.js

require('dotenv').config({ path: '.env.import' });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL || !process.env.MASTER_CHURCH_ID) {
  console.error('DATABASE_URL and MASTER_CHURCH_ID must both be set inline (see claude/running-backend-scripts.md).');
  process.exit(1);
}
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: isLocal ? false : { rejectUnauthorized: false } });

const toText = (html) =>
  (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/\*\*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

async function run() {
  try {
    const tags = await pool.query('SELECT name FROM tags WHERE church_id IS NULL ORDER BY lower(name)');
    const songs = await pool.query(
      `SELECT s.id, s.title, s.author, s.first_line, s.lyrics,
              COALESCE(array_agg(t.name ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '{}') AS tags
         FROM songs s
         LEFT JOIN song_tags st ON st.song_id = s.id
         LEFT JOIN tags t ON t.id = st.tag_id AND t.church_id IS NULL
        WHERE s.church_id = $1 AND (s.retired = false OR s.retired IS NULL)
        GROUP BY s.id
        ORDER BY lower(s.title)`,
      [process.env.MASTER_CHURCH_ID]
    );
    const out = {
      exported_at: new Date().toISOString(),
      vocabulary: tags.rows.map((r) => r.name),
      songs: songs.rows.map((s) => ({
        id: s.id, title: s.title, author: s.author || '', first_line: s.first_line || '',
        tags: s.tags, lyrics: toText(s.lyrics),
      })),
    };
    const dir = path.join(__dirname, '..', '..', 'tagging-work');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'export.json'), JSON.stringify(out, null, 1));
    const withLyrics = out.songs.filter((s) => s.lyrics).length;
    const untagged = out.songs.filter((s) => s.tags.length === 0).length;
    console.log(`✓ Exported ${out.songs.length} songs (${withLyrics} with lyrics, ${untagged} untagged) to tagging-work/export.json`);
  } catch (err) {
    console.error('Export failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
