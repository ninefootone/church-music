// Read-only: for a given search term, list the songs that match WITHIN ONE CHURCH
// and show WHICH field caused each match. Mirrors the /api/songs?search= WHERE,
// including the church_id scope the app applies (which the earlier version omitted).
//
// Usage:
//   1) List your churches to find the id:
//      cd ~/church-music/backend && DATABASE_URL="…" node scripts/explain-search-match.js
//   2) Run scoped to one church:
//      cd ~/church-music/backend && DATABASE_URL="…" node scripts/explain-search-match.js <church_id> adoration
 
require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');
 
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Pass it inline (see claude/running-backend-scripts.md).');
  process.exit(1);
}
 
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const args = process.argv.slice(2);
const churchId = args.find(a => UUID_RE.test(a)) || null;
const term = args.find(a => !UUID_RE.test(a)) || 'adoration';
 
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
 
async function run() {
  try {
    if (!churchId) {
      const cs = await pool.query(`
        SELECT c.id, c.name, COUNT(s.id)::int AS songs
        FROM churches c LEFT JOIN songs s ON s.church_id = c.id
        GROUP BY c.id, c.name ORDER BY songs DESC
      `);
      console.log('\nNo church id given. Your churches (pass one as the first arg):\n');
      for (const r of cs.rows) console.log(`  ${r.id}  ${r.songs.toString().padStart(4)} songs  ${r.name}`);
      console.log(`\nThen: node scripts/explain-search-match.js <church_id> ${term}\n`);
      return;
    }
 
    const lex = await pool.query(`SELECT plainto_tsquery('english', $1)::text AS q`, [term]);
    console.log(`\nChurch ${churchId} — search "${term}" (tsquery ${lex.rows[0].q}):\n`);
 
    const rows = await pool.query(`
      SELECT s.title,
        (to_tsvector('english', coalesce(s.title,''))            @@ plainto_tsquery('english',$1)) AS in_title,
        (to_tsvector('english', coalesce(s.author,''))           @@ plainto_tsquery('english',$1)) AS in_author,
        (to_tsvector('english', coalesce(s.first_line,''))       @@ plainto_tsquery('english',$1)) AS in_first_line,
        (to_tsvector('english', coalesce(s.bible_references,'')) @@ plainto_tsquery('english',$1)) AS in_refs,
        (to_tsvector('english', coalesce(s.notes,''))            @@ plainto_tsquery('english',$1)) AS in_notes,
        (to_tsvector('english', coalesce(s.lyrics,''))           @@ plainto_tsquery('english',$1)) AS in_lyrics,
        (s.tag_search_vector @@ plainto_tsquery('english',$1))   AS in_tags,
        (s.title ILIKE '%'||$1||'%')                             AS title_ilike
      FROM songs s
      WHERE s.church_id = $2
        AND (s.retired = FALSE OR s.retired IS NULL)
        AND (s.search_vector @@ plainto_tsquery('english',$1)
             OR s.tag_search_vector @@ plainto_tsquery('english',$1)
             OR s.title ILIKE '%'||$1||'%')
      ORDER BY s.title
    `, [term, churchId]);
 
    let tagCount = 0, lyricOnly = 0, titleCount = 0;
    for (const r of rows.rows) {
      const fields = [];
      if (r.in_title || r.title_ilike) { fields.push('title'); titleCount++; }
      if (r.in_author) fields.push('author');
      if (r.in_first_line) fields.push('first_line');
      if (r.in_refs) fields.push('bible_refs');
      if (r.in_notes) fields.push('notes');
      if (r.in_lyrics) fields.push('lyrics');
      if (r.in_tags) { fields.push('TAGS'); tagCount++; }
      if (!r.in_tags && !r.in_title && !r.title_ilike &&
          (r.in_lyrics || r.in_notes || r.in_author || r.in_first_line || r.in_refs)) lyricOnly++;
      console.log(`- "${r.title}"  → ${fields.join(', ')}`);
    }
 
    console.log(`\n${rows.rowCount} results in this church:`);
    console.log(`  matched via a tag:                 ${tagCount}`);
    console.log(`  matched via title:                 ${titleCount}`);
    console.log(`  matched ONLY via lyrics/notes/etc.: ${lyricOnly}  <- remove tag-search and these stay`);
    console.log(`\nIf you dropped tags from free-text search, you'd lose ${tagCount} result(s) and keep ${lyricOnly}.`);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}
 
run();
 

