// READ-ONLY trial of the ChurchSuite API v2 (Planning module). Touches NOTHING in SongStack.
//
// What it does:
//   1. Gets an access token with your ChurchSuite API user's Client ID + Secret.
//   2. Lists plans in the next N weeks (published + drafts) with their items in order:
//      song name, CCLI number, arrangement, key, and each plan's "last modified" time.
//   3. Saves what it saw to churchsuite-snapshot.json. On the NEXT run it prints what changed
//      since then (songs added/removed/reordered, key changes, new/deleted plans).
//
// Setup: create backend/.env.churchsuite (git-ignored) containing:
//   CS_CLIENT_ID=...
//   CS_CLIENT_SECRET=...
//
// Run (from ~/church-music/backend):
//   node scripts/churchsuite-spike.js              # next 6 weeks
//   node scripts/churchsuite-spike.js --weeks=10
//   node scripts/churchsuite-spike.js --raw        # also dump the raw JSON of the first plan's items
//
// API reference: OpenAPI spec at github.com/ChurchSuite/churchsuite-api (src/planning.yaml).

require('dotenv').config({ path: '.env.churchsuite' });
const fs = require('fs');
const path = require('path');

const API = 'https://api.churchsuite.com/v2';
const TOKEN_URL = 'https://login.churchsuite.com/oauth2/token';
const SNAPSHOT = path.join(__dirname, '..', 'churchsuite-snapshot.json');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));
const WEEKS = parseInt(args.weeks || '6', 10);

const { CS_CLIENT_ID, CS_CLIENT_SECRET } = process.env;
if (!CS_CLIENT_ID || !CS_CLIENT_SECRET) {
  console.error('CS_CLIENT_ID / CS_CLIENT_SECRET missing — put them in backend/.env.churchsuite');
  process.exit(1);
}

async function getToken() {
  const body = new URLSearchParams({ grant_type: 'client_credentials', scope: 'planning.read' });
  const basic = Buffer.from(`${CS_CLIENT_ID}:${CS_CLIENT_SECRET}`).toString('base64');
  let res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
    body,
  });
  if (!res.ok) {
    // Some OAuth servers want the credentials in the body instead of a Basic header.
    body.set('client_id', CS_CLIENT_ID);
    body.set('client_secret', CS_CLIENT_SECRET);
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`Token request failed (${res.status}): ${text}`);
  const json = JSON.parse(text);
  console.log(`✓ Got a token (expires in ${json.expires_in ?? '?'}s, scope: ${json.scope ?? 'not stated'})`);
  return json.access_token;
}

let TOKEN;
async function api(pathAndQuery) {
  const res = await fetch(`${API}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
  });
  if (res.status === 429) {
    const wait = parseInt(res.headers.get('retry-after') || '5', 10);
    console.log(`  (rate limited — waiting ${wait}s)`);
    await new Promise(r => setTimeout(r, wait * 1000));
    return api(pathAndQuery);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${pathAndQuery} → ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function listAll(pathAndQuery) {
  const out = [];
  for (let page = 1; page < 50; page++) {
    const sep = pathAndQuery.includes('?') ? '&' : '?';
    const json = await api(`${pathAndQuery}${sep}page=${page}&per_page=100`);
    out.push(...json.data);
    const p = json.pagination || {};
    const more = p.next_page ?? (p.num_pages ? page < p.num_pages : json.data.length === 100);
    if (!more) break;
  }
  return out;
}

const arrangementCache = new Map();
const songCache = new Map();
async function songFor(arrangementId) {
  if (!arrangementId) return null;
  if (!arrangementCache.has(arrangementId)) {
    arrangementCache.set(arrangementId, (await api(`/planning/song_arrangements/${arrangementId}`)).data);
  }
  const arr = arrangementCache.get(arrangementId);
  if (!songCache.has(arr.song_id)) {
    songCache.set(arr.song_id, (await api(`/planning/songs/${arr.song_id}`)).data);
  }
  const song = songCache.get(arr.song_id);
  return { song_id: song.id, song: song.name, ccli: song.ccli, arrangement: arr.name, arrangement_key: arr.key };
}

const ymd = d => d.toISOString().slice(0, 10);

(async () => {
  try {
    TOKEN = await getToken();

    const from = new Date(); from.setDate(from.getDate() - 1);
    const to = new Date(); to.setDate(to.getDate() + WEEKS * 7);
    const q = `starts_after=${ymd(from)}&starts_before=${ymd(to)}&order_by=date:asc`;
    const plans = [
      ...(await listAll(`/planning/plans?${q}&status=published`)),
      ...(await listAll(`/planning/plans?${q}&status=draft`)),
    ].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

    console.log(`\n${plans.length} plan(s) between ${ymd(from)} and ${ymd(to)}\n`);
    const snapshot = {};

    for (const plan of plans) {
      const items = await listAll(`/planning/plan_items?plan_ids[]=${plan.id}&order_by=order:asc`);
      if (args.raw && plan === plans[0]) {
        console.log('RAW plan:', JSON.stringify(plan, null, 2));
        console.log('RAW items:', JSON.stringify(items, null, 2));
      }
      console.log(`■ ${plan.date} ${plan.time || ''}  ${plan.name}  [${plan.status}]  id=${plan.id}  modified ${plan.modified_at || '?'}`);

      const rows = [];
      for (const it of items) {
        if (it.type === 'song') {
          const s = await songFor(it.arrangement_id);
          const key = it.settings?.key || s?.arrangement_key || '';
          rows.push({ id: it.id, type: 'song', name: s?.song || it.name, ccli: s?.ccli ?? null, key, modified_at: it.modified_at });
          console.log(`    ♪ ${s?.song || it.name}${s?.ccli ? `  (CCLI ${s.ccli})` : '  (no CCLI)'}${key ? `  key ${key}` : ''}${s && s.arrangement !== s.song ? `  arr: ${s.arrangement}` : ''}`);
        } else {
          rows.push({ id: it.id, type: 'item', name: it.name, modified_at: it.modified_at });
          console.log(`    · ${it.name}`);
        }
      }
      snapshot[plan.id] = { name: plan.name, date: plan.date, time: plan.time, status: plan.status, modified_at: plan.modified_at, items: rows };
      console.log('');
    }

    // ---- What changed since last run? ----
    if (fs.existsSync(SNAPSHOT)) {
      const prev = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
      console.log('=== Changes since last run ===');
      let changes = 0;
      const say = m => { changes++; console.log(m); };
      for (const id of Object.keys(prev)) if (!snapshot[id]) say(`- Plan gone (deleted or outside the date window): ${prev[id].date} ${prev[id].name}`);
      for (const [id, cur] of Object.entries(snapshot)) {
        const old = prev[id];
        if (!old) { say(`+ New plan: ${cur.date} ${cur.name}`); continue; }
        const label = `${cur.date} ${cur.name}`;
        const planModChanged = old.modified_at !== cur.modified_at;
        for (const f of ['name', 'date', 'time', 'status']) if (old[f] !== cur[f]) say(`~ ${label}: ${f} "${old[f]}" → "${cur[f]}"`);
        const oldSongs = old.items.filter(i => i.type === 'song');
        const curSongs = cur.items.filter(i => i.type === 'song');
        const oldIds = old.items.map(i => i.id).join(',');
        const curIds = cur.items.map(i => i.id).join(',');
        for (const s of curSongs) if (!oldSongs.find(o => o.id === s.id)) say(`~ ${label}: song added — ${s.name}`);
        for (const s of oldSongs) if (!curSongs.find(c => c.id === s.id)) say(`~ ${label}: song removed — ${s.name}`);
        for (const s of curSongs) {
          const o = oldSongs.find(x => x.id === s.id);
          if (o && o.key !== s.key) say(`~ ${label}: ${s.name} key ${o.key || '—'} → ${s.key || '—'}`);
          if (o && o.name !== s.name) say(`~ ${label}: song swapped on the same line — ${o.name} → ${s.name}`);
        }
        const sameSet = oldIds.split(',').sort().join() === curIds.split(',').sort().join();
        if (sameSet && oldIds !== curIds) say(`~ ${label}: running order changed`);
        // The important test: did the plan's own modified_at move when its items changed?
        if (oldIds !== curIds || JSON.stringify(old.items) !== JSON.stringify(cur.items)) {
          console.log(`    ↳ plan modified_at ${planModChanged ? 'DID' : 'did NOT'} change (${old.modified_at} → ${cur.modified_at})`);
        }
      }
      if (!changes) console.log('No changes.');
    } else {
      console.log('(First run — snapshot saved. Change something in ChurchSuite, then run again to see the diff.)');
    }

    fs.writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2));
  } catch (e) {
    console.error('\n✗', e.message);
    process.exit(1);
  }
})();
