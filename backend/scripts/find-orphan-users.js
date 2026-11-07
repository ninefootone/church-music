// Read-only. Lists every user in Clerk (production) and prints a SQL query to paste into the
// Railway Postgres Data tab. That query returns rows in `users` whose clerk_id no longer exists in
// Clerk — i.e. accounts deleted in the Clerk dashboard, which leaves the DB rows behind.
// Talks to Clerk only — no database connection, so no TCP proxy needed.
//
// Run (secret key from Railway → backend service → Variables, single-quoted, never saved to a file):
//   cd ~/church-music/backend && CLERK_SECRET_KEY='sk_live_…' node scripts/find-orphan-users.js
const { createClerkClient } = require('@clerk/backend');

const key = process.env.CLERK_SECRET_KEY;
if (!key) {
  console.error('CLERK_SECRET_KEY is not set — put it inline before `node` (see top of file).');
  process.exit(1);
}
if (!key.startsWith('sk_live_')) {
  console.error('That is not a production key (expected sk_live_…). Use the backend service key from Railway.');
  process.exit(1);
}

(async () => {
  const clerk = createClerkClient({ secretKey: key });
  const ids = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await clerk.users.getUserList({ limit, offset });
    const rows = Array.isArray(page) ? page : page.data;
    ids.push(...rows.map((u) => u.id));
    if (rows.length < limit) break;
  }
  console.error(`Clerk has ${ids.length} users. Paste the SQL below into the Railway Data tab:\n`);
  const list = ids.map((id) => `('${id.replace(/'/g, "''")}')`).join(',\n  ');
  console.log(`SELECT u.clerk_id, u.email, u.name, u.created_at,
  (SELECT count(*) FROM memberships m WHERE m.user_id = u.id) AS memberships,
  (SELECT count(*) FROM churches c WHERE c.created_by = u.id) AS churches_created
FROM users u
WHERE u.clerk_id NOT IN (SELECT id FROM (VALUES
  ${list}
) AS clerk(id))
ORDER BY u.created_at;`);
})().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
