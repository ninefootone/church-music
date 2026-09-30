// Read-only: for title substrings, show every matching song (master + church copies)
// with its church, sharing flags, and actual tag names.
// Usage: DATABASE_URL="..." MASTER_CHURCH_ID="..." node scripts/diagnose-song-tags.js "Spirit Of God" "ZZ Tag Test"
require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is unset'); process.exit(1); }
const needles = process.argv.slice(2);
if (!needles.length) { console.error('Pass one or more title substrings'); process.exit(1); }

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const master = process.env.MASTER_CHURCH_ID || null;

  // $1 is master id; $2.. are the title needles.
  const likeClauses = needles.map((_, i) => `s.title ILIKE '%' || $${i + 2} || '%'`).join(' OR ');
  const { rows } = await pool.query(
    `SELECT s.id,
            s.title,
            s.church_id,
            (s.church_id = $1) AS is_master,
            s.in_library,
            s.in_discover,
            s.is_template,
            s.template_status,
            s.is_draft,
            s.share_all_data,
            COALESCE(
              (SELECT string_agg(t.name || ' [' ||
                        CASE WHEN t.church_id IS NULL THEN 'global'
                             WHEN t.church_id = s.church_id THEN 'own'
                             ELSE 'other-church' END || ']', ', ')
               FROM song_tags st JOIN tags t ON t.id = st.tag_id
               WHERE st.song_id = s.id),
              '(none)') AS tags
     FROM songs s
     WHERE ${likeClauses}
     ORDER BY is_master DESC, s.title, s.church_id`,
    [master, ...needles]
  );

  if (!rows.length) { console.log('No songs match:', needles.join(', ')); await pool.end(); return; }
  console.table(rows.map(r => ({
    title: r.title,
    where: r.is_master ? 'MASTER' : r.church_id.slice(0, 8),
    in_library: r.in_library,
    in_discover: r.in_discover,
    is_template: r.is_template,
    template_status: r.template_status,
    is_draft: r.is_draft,
    share_all: r.share_all_data,
    tags: r.tags,
  })));

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });