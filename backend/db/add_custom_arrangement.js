const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function migrate() {
  await pool.query(`
    ALTER TABLE service_items
      ADD COLUMN IF NOT EXISTS custom_arrangement TEXT;
  `)
  console.log('Done: custom_arrangement added to service_items')
  await pool.end()
}

migrate().catch(err => { console.error(err); process.exit(1) })