// Read-only: are there leftover songs from the removed POST /api/templates/contribute route?
// That route created church-less "pending" songs (church_id NULL, is_template true,
// template_status 'pending', contributed_by = the contributing church). Nothing ever
// reviewed them, and contributed_by can block that church being deleted (see
// utils/accountDeletion.js, 'church_data_in_use').
//
// Runs inside a READ ONLY transaction, so it cannot change anything.
//
// Usage:
//   cd ~/church-music/backend && DATABASE_URL='…Railway URL…' node scripts/check-contributed-songs.js

require('dotenv').config({ path: '.env.import' });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (single-quote it; put it right before node).');
  process.exit(1);
}
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const rows = await client.query(`
      SELECT s.id, s.title, s.author, s.template_status, s.church_id, s.created_at,
             s.contributed_by, c.name AS contributed_by_church
        FROM songs s
        LEFT JOIN churches c ON c.id = s.contributed_by
       WHERE s.contributed_by IS NOT NULL
       ORDER BY s.created_at`);
    console.log(`\n== Songs with contributed_by set: ${rows.rows.length} ==`);
    if (rows.rows.length) console.table(rows.rows);
    else console.log('None — nothing to clean up.');
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
