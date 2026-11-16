// READ-ONLY dry run: what WOULD a ChurchSuite → SongStack sync change for Endcliffe's existing plans?
// Compares live ChurchSuite plans with an export of the SongStack plans. Writes nothing anywhere.
//
// 1. Railway → Postgres → Data tab: run backend/scripts/churchsuite-export-songstack.sql and save the
//    single "export" cell as backend/songstack-export.json (git-ignored).
// 2. From ~/church-music/backend:   node scripts/churchsuite-compare.js
//
// Needs backend/.env.churchsuite (CS_CLIENT_ID / CS_CLIENT_SECRET), as for churchsuite-spike.js.

require('dotenv').config({ path: '.env.churchsuite' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('./lib/churchsuite');
const { buildReport } = require('./lib/churchsuite-report');

const EXPORT = path.join(__dirname, '..', 'songstack-export.json');
const { CS_CLIENT_ID, CS_CLIENT_SECRET } = process.env;
if (!CS_CLIENT_ID || !CS_CLIENT_SECRET) { console.error('CS_CLIENT_ID / CS_CLIENT_SECRET missing — see backend/.env.churchsuite'); process.exit(1); }
if (!fs.existsSync(EXPORT)) { console.error('backend/songstack-export.json not found — run churchsuite-export-songstack.sql in the Railway Data tab first.'); process.exit(1); }

let ss;
try {
  let text = fs.readFileSync(EXPORT, 'utf8').trim();
  if (text.startsWith('"')) text = JSON.parse(text);           // pasted as a quoted string
  ss = JSON.parse(text);
} catch (e) {
  console.error('songstack-export.json is not valid JSON — it may have been cut off when copying. ' + e.message);
  process.exit(1);
}

const ymd = d => d.toISOString().slice(0, 10);

(async () => {
  const cs = createClient(CS_CLIENT_ID, CS_CLIENT_SECRET);
  const from = new Date(); from.setDate(from.getDate() - 1);
  const to = new Date(); to.setDate(to.getDate() + 49);
  const { text } = await buildReport(cs, ss, ymd(from), ymd(to));
  console.log(text);
})().catch(e => { console.error('✗', e.message); process.exit(1); });
