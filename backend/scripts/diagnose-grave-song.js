require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — aborting rather than falling back to localhost.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Show the exact bytes so an invisible/curly-quote/unicode-comma issue can't hide.
const hex = (s) => (s == null ? 'NULL' : Buffer.from(s, 'utf8').toString('hex'));

const run = async () => {
  const client = await pool.connect();
  try {
    console.log('=== songs matching "grave" and "victory" (any church) ===');
    const { rows: songs } = await client.query(`
      SELECT id, church_id, title, ccli_number, share_all_data, is_template,
             template_status, in_library, in_discover, updated_at
      FROM songs
      WHERE title ILIKE '%grave%' AND title ILIKE '%victory%'
      ORDER BY church_id, updated_at
    `);
    for (const s of songs) {
      console.log('---');
      console.log('id:', s.id, ' church_id:', s.church_id, ' MASTER:', s.church_id === process.env.MASTER_CHURCH_ID);
      console.log('title:', JSON.stringify(s.title));
      console.log('title hex:', hex(s.title));
      console.log('ccli_number:', s.ccli_number, ' share_all_data:', s.share_all_data,
        ' is_template:', s.is_template, ' template_status:', s.template_status,
        ' in_library:', s.in_library, ' in_discover:', s.in_discover, ' updated_at:', s.updated_at);
    }

    if (songs.length === 0) {
      console.log('No matching songs found at all — title may have drifted further than expected.');
      return;
    }

    const ccliNumbers = [...new Set(songs.map(s => s.ccli_number).filter(Boolean))];
    if (ccliNumbers.length) {
      console.log('\n=== matching ccli_lookup rows ===');
      const { rows: lookups } = await client.query(
        `SELECT ccli_number, title, author, source_church_id, confirmed_count, updated_at
         FROM ccli_lookup WHERE ccli_number = ANY($1::text[])`,
        [ccliNumbers]
      );
      for (const l of lookups) {
        console.log('---');
        console.log('ccli_number:', l.ccli_number);
        console.log('cached title:', JSON.stringify(l.title));
        console.log('cached title hex:', hex(l.title));
        console.log('source_church_id:', l.source_church_id, ' confirmed_count:', l.confirmed_count, ' updated_at:', l.updated_at);
      }
      if (lookups.length === 0) console.log('(no ccli_lookup row for this ccli_number)');
    } else {
      console.log('\nNo ccli_number on the matching song(s) — ccli_lookup/autocomplete is not the source of the corruption.');
    }
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch(err => { console.error('Diagnosis failed:', err); process.exit(1); });