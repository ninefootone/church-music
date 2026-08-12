require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const fixes = [
  ["Psalm 23 (The Lord\u2019s My Shepherd)", "Psalm 23 (The Lord's My Shepherd)"],
  ["May the people\u2019s praise you",        "May the people's praise you"],
  ["Of the Father\u2019s love begotten",      "Of the Father's love begotten"],
  ["God doesn\u2019t have a birthday",        "God doesn't have a birthday"],
  ["He\u2019s coming back again",             "He's coming back again"],
  ["God\u2019s People In God\u2019s Place",   "God's People In God's Place"],
  ["It\u2019s A Light And A Hammer",          "It's A Light And A Hammer"],
  ["Heaven\u2019s home",                      "Heaven's home"],
];

async function main() {
  const client = await pool.connect();
  try {
    for (const [from, to] of fixes) {
      const res = await client.query(
        'UPDATE songs SET title = $1 WHERE title = $2',
        [to, from]
      );
      console.log(`${res.rowCount > 0 ? '✓' : '–'} ${to}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });