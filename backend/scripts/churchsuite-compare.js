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
const { createClient, norm, titleVariants } = require('./lib/churchsuite');

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
const hhmm = t => (t || '').slice(0, 5);
const nice = t => { if (!t) return '?'; const [h, m] = t.split(':').map(Number); return `${(h % 12) || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`; };
const dayLabel = d => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

// Service time for a ChurchSuite plan: time in its name ("Sunday 9:15"), else the Welcome item's start, else the plan time.
function csServiceTime(plan, items) {
  const m = (plan.name || '').match(/(\d{1,2})[:.](\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  const welcome = items.find(i => /welcome/i.test(i.type_name) && i.time_start);
  if (welcome) return hhmm(welcome.time_start);
  return hhmm(plan.time);
}

const STRUCTURAL = /^(set ?up|tech|music rehearsal.*|rehearsal.*|sound ?check)$/;
const ssSongTitle = it => it.song || it.title || '';
const ssLabel = it => it.title || it.song || it.type || '';

function matchSong(csTitle, ssSongs, used) {
  const cv = titleVariants(csTitle);
  let idx = ssSongs.findIndex((s, i) => !used.has(i) && titleVariants(ssSongTitle(s))[0] === cv[0]);
  if (idx < 0) idx = ssSongs.findIndex((s, i) => !used.has(i) && titleVariants(ssSongTitle(s)).some(v => cv.includes(v)));
  return idx;
}

function multisetDiff(a, b) {   // items in a not in b (by normalised label), keeping a's wording
  const counts = new Map();
  for (const x of b) counts.set(norm(x), (counts.get(norm(x)) || 0) + 1);
  const out = [];
  for (const x of a) { const k = norm(x); if (counts.get(k)) counts.set(k, counts.get(k) - 1); else out.push(x); }
  return out;
}

(async () => {
  const cs = createClient(CS_CLIENT_ID, CS_CLIENT_SECRET);
  const from = new Date(); from.setDate(from.getDate() - 1);
  const to = new Date(); to.setDate(to.getDate() + 49);
  const csPlans = await cs.plans(ymd(from), ymd(to));
  for (const p of csPlans) { p.items = await cs.planItems(p.id); p.serviceTime = csServiceTime(p, p.items); }

  const members = new Map((ss.members || []).map(n => [norm(n), n]));
  const dates = [...new Set([...csPlans.map(p => p.date), ...ss.plans.map(p => p.date)])].sort();
  const tally = { dates: 0, identical: 0, songChanges: 0, keyChanges: 0, serviceDiffs: 0, timeDiffs: 0, peopleToAdd: new Set(), peopleNotMembers: new Set() };

  console.log(`ChurchSuite: ${csPlans.length} plans · SongStack (${ss.church}, exported ${String(ss.exported_at).slice(0, 16).replace('T', ' ')}): ${ss.plans.length} plans · ${ymd(from)} → ${ymd(to)}\n`);

  for (const date of dates) {
    tally.dates++;
    const cps = csPlans.filter(p => p.date === date).sort((a, b) => a.serviceTime.localeCompare(b.serviceTime));
    const sps = ss.plans.filter(p => p.date === date);
    const out = [];
    const say = (s = '') => out.push(s);
    let changes = 0;

    say(`══ ${dayLabel(date)} ${'═'.repeat(40)}`);
    say(`ChurchSuite: ${cps.length ? cps.map(p => `"${p.name}" → ${nice(p.serviceTime)} [${p.status}]`).join('; ') : '— none —'}`);
    say(`SongStack:   ${sps.length ? sps.map(p => `${p.title ? `"${p.title}" ` : ''}${[p.start, ...(p.extra || [])].map(nice).join(' & ')} [${p.status}]`).join('; ') : '— none —'}`);

    if (!cps.length) { say('  → Only in SongStack. A sync would leave it alone (not linked).'); console.log(out.join('\n') + '\n'); continue; }
    if (!sps.length) { say(`  → Only in ChurchSuite. A sync would CREATE a SongStack plan${cps.length > 1 ? ` with ${cps.length} service times` : ''}.`); changes++; console.log(out.join('\n') + '\n'); continue; }
    if (sps.length > 1) say(`  ⚠ ${sps.length} SongStack plans on this date — comparing with the first only.`);

    const sp = sps[0];
    const ref = cps[0];

    // --- times
    const csTimes = cps.map(p => p.serviceTime);
    const ssTimes = [sp.start, ...(sp.extra || [])].filter(Boolean);
    if (csTimes.join() !== ssTimes.join()) { say(`  ✗ Times: ChurchSuite ${csTimes.map(nice).join(' & ')} vs SongStack ${ssTimes.map(nice).join(' & ')}`); tally.timeDiffs++; changes++; }
    else say(`  ✓ Times match (ChurchSuite plan times ${cps.map(p => nice(hhmm(p.time))).join(' & ')} ignored — those are set-up times)`);
    if (cps.some(p => p.status === 'draft') && sp.status === 'published') say('  ℹ Draft in ChurchSuite but published in SongStack');

    // --- do the ChurchSuite services differ from each other?
    for (const other of cps.slice(1)) {
      const a = ref.items.filter(i => !STRUCTURAL.test(norm(i.label))).map(i => i.label);
      const b = other.items.filter(i => !STRUCTURAL.test(norm(i.label))).map(i => i.label);
      const onlyA = multisetDiff(a, b), onlyB = multisetDiff(b, a);
      const keyDiffs = ref.items.filter(i => i.kind === 'song').map(i => {
        const o = other.items.find(x => x.kind === 'song' && norm(x.label) === norm(i.label));
        return o && o.key !== i.key ? `${i.label} (${i.key || '—'} vs ${o.key || '—'})` : null;
      }).filter(Boolean);
      if (onlyA.length || onlyB.length || keyDiffs.length) {
        tally.serviceDiffs++; changes++;
        say(`  ⚠ The ChurchSuite services differ — one SongStack plan can't show this as-is:`);
        if (onlyA.length) say(`      only at ${nice(ref.serviceTime)}: ${onlyA.join(', ')}`);
        if (onlyB.length) say(`      only at ${nice(other.serviceTime)}: ${onlyB.join(', ')}`);
        if (keyDiffs.length) say(`      different keys: ${keyDiffs.join(', ')}`);
      }
    }

    // --- songs (ChurchSuite first service vs SongStack)
    const csSongs = ref.items.filter(i => i.kind === 'song');
    const ssSongs = sp.items.filter(i => i.type === 'song');
    const used = new Set(); const order = []; const songLines = [];
    for (const s of csSongs) {
      const idx = matchSong(s.label, ssSongs, used);
      if (idx < 0) { songLines.push(`      + ${s.label}  (in ChurchSuite, not in the SongStack plan)`); tally.songChanges++; changes++; continue; }
      used.add(idx); order.push(idx);
      const ssKey = ssSongs[idx].key || '';
      if (s.key && s.key !== ssKey) { songLines.push(`      ~ ${s.label}: key ${ssKey || '— (song default ' + (ssSongs[idx].default_key || '—') + ')'} → ${s.key}`); tally.keyChanges++; changes++; }
      else if (!s.key && ssKey) songLines.push(`      ℹ ${s.label}: SongStack has key ${ssKey}, ChurchSuite has none (sync would keep or clear it — decision)`);
    }
    ssSongs.forEach((s, i) => { if (!used.has(i)) { songLines.push(`      − ${ssSongTitle(s)}  (in SongStack, not in ChurchSuite)`); tally.songChanges++; changes++; } });
    const inOrder = order.every((v, i) => i === 0 || v > order[i - 1]);
    if (!inOrder) { songLines.push('      ↕ song order differs'); tally.songChanges++; changes++; }
    say(`  Songs: ${csSongs.length} in ChurchSuite, ${ssSongs.length} in SongStack${songLines.length ? '' : ' — ✓ same songs, same order, keys agree'}`);
    songLines.forEach(l => say(l));

    // --- other items (labels differ between systems, so this is a rough guide)
    const csOther = ref.items.filter(i => i.kind !== 'song' && !STRUCTURAL.test(norm(i.label))).map(i => i.label);
    const ssOther = sp.items.filter(i => i.type !== 'song' && i.phase !== 'pre-service' && !STRUCTURAL.test(norm(ssLabel(i)))).map(ssLabel);
    const onlyCs = multisetDiff(csOther, ssOther), onlySs = multisetDiff(ssOther, csOther);
    if (onlyCs.length || onlySs.length) {
      say('  Other items (names may simply differ between the two systems):');
      if (onlyCs.length) say(`      ChurchSuite only: ${onlyCs.join(', ')}`);
      if (onlySs.length) say(`      SongStack only:   ${onlySs.join(', ')}`);
    }

    // --- people: music team = people assigned to song items in ChurchSuite (any service)
    const team = new Map();
    for (const p of cps) for (const i of p.items) if (i.kind === 'song') for (const n of i.people) {
      if (!team.has(norm(n))) team.set(norm(n), { name: n, services: new Set() });
      team.get(norm(n)).services.add(p.serviceTime);
    }
    const ssMus = new Map((sp.musicians || []).map(m => [norm(m.name), m]));
    if (team.size || ssMus.size) say('  Music team:');
    for (const [k, t] of team) {
      const m = ssMus.get(k);
      const only = t.services.size < cps.length ? `  (only at ${[...t.services].map(nice).join(', ')})` : '';
      if (m) say(`      ✓ ${t.name} — on the SongStack plan${m.role ? ` as ${m.role}` : ''}${m.linked ? ' (linked account)' : ' (name only)'}${only}`);
      else {
        changes++; tally.peopleToAdd.add(t.name);
        if (members.has(k)) say(`      + ${t.name} — not on the SongStack plan; IS a SongStack member → would link to their account${only}`);
        else { tally.peopleNotMembers.add(t.name); say(`      + ${t.name} — not on the SongStack plan; NOT a SongStack member → would be added by name only${only}`); }
      }
    }
    for (const [k, m] of ssMus) if (!team.has(k)) say(`      − ${m.name}${m.role ? ` (${m.role})` : ''} — on the SongStack plan, not on any ChurchSuite song item`);

    const others = new Set();
    for (const p of cps) for (const i of p.items) if (i.kind !== 'song') for (const n of i.people) if (!team.has(norm(n))) others.add(n);
    if (others.size) say(`  Other people in ChurchSuite (not music — would NOT be copied): ${others.size}`);

    if (!changes) tally.identical++;
    say(changes ? '' : '  → Already in step. A sync would change nothing.');
    console.log(out.join('\n') + '\n');
  }

  console.log('══ Summary ' + '═'.repeat(40));
  console.log(`${tally.dates} dates · ${tally.identical} already in step · ${tally.songChanges} song add/remove/order differences · ${tally.keyChanges} key differences`);
  console.log(`${tally.timeDiffs} time mismatches · ${tally.serviceDiffs} dates where the two ChurchSuite services differ`);
  console.log(`Music team people missing from SongStack plans: ${tally.peopleToAdd.size}${tally.peopleNotMembers.size ? ` (${tally.peopleNotMembers.size} not SongStack members: ${[...tally.peopleNotMembers].join(', ')})` : ''}`);
})().catch(e => { console.error('✗', e.message); process.exit(1); });
