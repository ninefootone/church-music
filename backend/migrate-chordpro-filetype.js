const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  await pool.query(`
    ALTER TABLE song_files DROP CONSTRAINT song_files_file_type_check;
    ALTER TABLE song_files ADD CONSTRAINT song_files_file_type_check 
      CHECK (file_type IN ('chords', 'lead', 'vocal', 'full_score', 'other', 'chordpro'));
  `);
  console.log('Done — chordpro added to file_type constraint');
  await pool.end();
}

run().catch(e => { console.error(e); pool.end(); });