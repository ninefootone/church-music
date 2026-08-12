const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function run() {
  // 1. Strip all song_tags
  const st = await pool.query('DELETE FROM song_tags')
  console.log(`Deleted ${st.rowCount} song_tag rows`)

  // 2. Strip all tags
  const t = await pool.query('DELETE FROM tags')
  console.log(`Deleted ${t.rowCount} tag rows`)

  // 3. Allow church_id to be NULL (global tags) — already nullable via schema,
  //    but add a unique constraint on name alone for global tags
  await pool.query(`
    ALTER TABLE tags
    DROP CONSTRAINT IF EXISTS tags_church_id_name_key
  `)
  await pool.query(`
    ALTER TABLE tags
    ADD CONSTRAINT tags_global_name_unique
    UNIQUE NULLS NOT DISTINCT (church_id, name)
  `)
  console.log('Constraint updated')

  await pool.end()
}

run().catch(err => { console.error(err); process.exit(1) })