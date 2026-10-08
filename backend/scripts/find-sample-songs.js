// READ-ONLY. Finds the master-library songs used as new-church samples and shows
// what each would copy (lyrics, files, videos, tags) so we can pick exact IDs.
require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — aborting rather than falling back to localhost.');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const SEARCHES = [
  { label: 'If Christ Is Mine (Joyful Noise)',        where: `s.title ILIKE '%christ is mine%'` },
  { label: 'God Showed Us His Love (Awesome Cutlery)', where: `s.title ILIKE '%showed us his love%'` },
  { label: 'Where, O Grave, Is Your Victory? (Ben Slee)', where: `s.title ILIKE '%grave%' AND s.title ILIKE '%victory%'` },
];

(async () => {
  const client = await pool.connect();
  try {
    for (const search of SEARCHES) {
      console.log(`\n================ ${search.label} ================`);
      const { rows } = await client.query(`
        SELECT s.id, s.church_id, c.name AS church_name, c.is_curator, s.title, s.author,
               s.default_key, s.ccli_number, s.in_library, s.in_discover, s.share_all_data,
               LENGTH(COALESCE(s.lyrics, '')) AS lyrics_chars,
               (SELECT COUNT(*) FROM song_files f WHERE f.song_id = s.id) AS files,
               (SELECT string_agg(f.file_type || ':' || COALESCE(f.label, ''), ', ') FROM song_files f WHERE f.song_id = s.id) AS file_list,
               (SELECT COUNT(*) FROM song_videos v WHERE v.song_id = s.id) AS videos,
               (SELECT string_agg(t.name, ', ') FROM song_tags st JOIN tags t ON t.id = st.tag_id WHERE st.song_id = s.id) AS tags
        FROM songs s JOIN churches c ON c.id = s.church_id
        WHERE ${search.where} AND (c.is_curator = TRUE OR s.in_library = TRUE)
        ORDER BY c.is_curator DESC, s.created_at`);
      if (rows.length === 0) { console.log('  NOT FOUND in a curator church / the library'); continue; }
      for (const r of rows) {
        console.log('---');
        console.log(`  id:        ${r.id}`);
        console.log(`  church:    ${r.church_name} (curator: ${r.is_curator})`);
        console.log(`  title:     ${JSON.stringify(r.title)}  |  author: ${r.author}  |  key: ${r.default_key}  |  CCLI: ${r.ccli_number}`);
        console.log(`  in_library: ${r.in_library}  in_discover: ${r.in_discover}  share_all_data: ${r.share_all_data}`);
        console.log(`  lyrics: ${r.lyrics_chars} chars  |  files: ${r.files} (${r.file_list || '-'})  |  videos: ${r.videos}`);
        console.log(`  tags: ${r.tags || '(none)'}`);
      }
    }
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
