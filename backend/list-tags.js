const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const all = await pool.query(`
    SELECT 
      t.name AS tag,
      COUNT(st.song_id)::int AS song_count
    FROM tags t
    JOIN song_tags st ON st.tag_id = t.id
    JOIN songs s ON s.id = st.song_id
    WHERE s.church_id = 'b0c60082-789e-48c7-be6c-2237ea5a5c39'
    GROUP BY t.name
    ORDER BY song_count DESC
  `);

  console.log('\n=== ALL TAGS (most used first) ===');
  console.log('Count | Tag');
  console.log('------+----');
  all.rows.forEach(r => {
    console.log(`${String(r.song_count).padStart(5)} | ${r.tag}`);
  });
  console.log(`\nTotal tags: ${all.rows.length}`);

  const singles = all.rows.filter(r => r.song_count <= 2);
  console.log('\n=== TAGS USED ON 2 OR FEWER SONGS ===');
  console.log('Count | Tag');
  console.log('------+----');
  singles.forEach(r => {
    console.log(`${String(r.song_count).padStart(5)} | ${r.tag}`);
  });
  console.log(`\nTotal low-use tags: ${singles.length}`);

  await pool.end();
}

main().catch(console.error);