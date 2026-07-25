const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function run() {
  const categoriesToRemove = ['communion', 'lament', 'easter', 'christmas', 'all_age']

  const result = await pool.query(
    `UPDATE songs
     SET category = NULL
     WHERE category = ANY($1::text[])
     RETURNING id, title, category`,
    [categoriesToRemove]
  )

  console.log(`Cleared category from ${result.rowCount} song(s):`)
  result.rows.forEach(r => console.log(` - [${r.id}] ${r.title}`))

  await pool.end()
}

run().catch(err => { console.error(err); process.exit(1) })