// migrations/rename-arrangement-to-structure.js — section order (Verse 1, Chorus…) is now called "Structure".
//   songs.suggested_arrangement  → songs.suggested_structure
//   plan_items.custom_arrangement → plan_items.custom_structure
// Frees the word "arrangement" for song versions (see project doc song-versions-proposal.md).
//
// Follows the interim migration protocol (claude/running-backend-scripts.md): one transaction, idempotent,
// fails loud without DATABASE_URL, and verifies its own end state.
//
// TIMING: run straight after the Railway deploy that renames the columns in code goes green. Between the
// deploy and this script, song and plan pages error. Do it at a quiet time (not Saturday night / Sunday).
//
// Run:  cd ~/church-music/backend && DATABASE_URL='postgresql://…' node migrations/rename-arrangement-to-structure.js
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — refusing to run (would fall back to localhost).');
  process.exit(1);
}
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: isLocal ? false : { rejectUnauthorized: false } });

const RENAMES = [
  ['songs', 'suggested_arrangement', 'suggested_structure'],
  ['plan_items', 'custom_arrangement', 'custom_structure'],
];

async function hasColumn(q, table, column) {
  const r = await q.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return r.rows.length > 0;
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [table, from, to] of RENAMES) {
      const hasOld = await hasColumn(client, table, from);
      const hasNew = await hasColumn(client, table, to);
      if (hasOld && hasNew) throw new Error(`${table} has BOTH ${from} and ${to} — stop and look before doing anything.`);
      if (hasOld) {
        await client.query(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to}`);
        console.log(`renamed ${table}.${from} → ${to}`);
      } else {
        console.log(`${table}.${from} already renamed — skipping`);
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // ---- Verify the END STATE ----
  let ok = true;
  for (const [table, from, to] of RENAMES) {
    const good = (await hasColumn(pool, table, to)) && !(await hasColumn(pool, table, from));
    console.log(`${table}.${to}:`, good ? 'OK' : 'WRONG');
    if (!good) ok = false;
  }
  // Functions/triggers store their SQL as text, so a rename doesn't update them. Flag any that still use the old names.
  const fn = await pool.query(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND (p.prosrc ILIKE '%suggested_arrangement%' OR p.prosrc ILIKE '%custom_arrangement%')`
  );
  if (fn.rows.length) {
    ok = false;
    console.log('DB functions still using old names:', fn.rows.map((r) => r.proname).join(', '));
  } else {
    console.log('DB functions/triggers: none use the old names');
  }
  // Read test: the new columns are queryable.
  await pool.query('SELECT suggested_structure FROM songs LIMIT 1');
  await pool.query('SELECT custom_structure FROM plan_items LIMIT 1');
  console.log('read test: PASS');

  console.log(ok ? '✓ structure rename done' : '✗ verification FAILED');
  await pool.end();
  process.exit(ok ? 0 : 1);
}

run().catch(async (err) => {
  console.error('Migration failed (rolled back):', err.message);
  await pool.end();
  process.exit(1);
});
