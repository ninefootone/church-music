// Builds the ChurchSuite → SongStack dry-run report. READ-ONLY: it only compares.
// Used by scripts/churchsuite-compare.js (local, from an export file) and
// scripts/churchsuite-shadow.js (scheduled on Railway, straight from the database).
const { norm, titleVariants } = require('./churchsuite');

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

// A SongStack song's matchable forms: title variants + its first line.
const ssSongVariants = s => [...titleVariants(ssSongTitle(s)), norm(s.first_line)].filter(Boolean);

function matchSong(csTitle, ssSongs, used) {
  const cv = titleVariants(csTitle);
  let idx = ssSongs.findIndex((s, i) => !used.has(i) && titleVariants(ssSongTitle(s))[0] === cv[0]);
  if (idx < 0) idx = ssSongs.findIndex((s, i) => !used.has(i) && ssSongVariants(s).some(v => cv.includes(v)));
  return idx;
}

// Nicknames: same surname and one first name starts with the other ("Ben Smith" / "Benjamin Smith").
function likelySamePerson(a, b) {
  const pa = norm(a).split(' '), pb = norm(b).split(' ');
  if (pa.length < 2 || pb.length < 2 || pa[pa.length - 1] !== pb[pb.length - 1]) return false;
  const fa = pa[0], fb = pb[0];
  return fa !== fb && fa.length >= 2 && fb.length >= 2 && (fa.startsWith(fb) || fb.startsWith(fa));
}

function multisetDiff(a, b) {   // items in a not in b (by normalised label), keeping a's wording
  const counts = new Map();
  for (const x of b) counts.set(norm(x), (counts.get(norm(x)) || 0) + 1);
  const out = [];
  for (const x of a) { const k = norm(x); if (counts.get(k)) counts.set(k, counts.get(k) - 1); else out.push(x); }
  return out;
}


// cs = createClient(...) from ./churchsuite; ss = the SongStack export object
// ({ church, exported_at, members, plans }); from/to = YYYY-MM-DD.
// Returns { text, summary } — text is the full report, summary the last three lines.
async function buildReport(cs, ss, from, to) {
  const lines = [];
  const emit = (s = '') => lines.push(s);
  const csPlans = await cs.plans(from, to);
  for (const p of csPlans) { p.items = await cs.planItems(p.id); p.serviceTime = csServiceTime(p, p.items); }

  const members = new Map((ss.members || []).map(n => [norm(n), n]));
  const dates = [...new Set([...csPlans.map(p => p.date), ...ss.plans.map(p => p.date)])].sort();
  const tally = { dates: 0, identical: 0, songChanges: 0, keyChanges: 0, serviceDiffs: 0, timeDiffs: 0, itemOnlyDiffs: 0, peopleToAdd: new Set(), peopleNotMembers: new Set(), nicknames: new Set() };

  emit(`ChurchSuite: ${csPlans.length} plans · SongStack (${ss.church}, exported ${String(ss.exported_at).slice(0, 16).replace('T', ' ')}): ${ss.plans.length} plans · ${from} → ${to}\n`);

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

    if (!cps.length) { say('  → Only in SongStack. A sync would leave it alone (not linked).'); emit(out.join('\n') + '\n'); continue; }
    if (!sps.length) { say(`  → Only in ChurchSuite. A sync would CREATE a SongStack plan${cps.length > 1 ? ` with ${cps.length} service times` : ''}.`); changes++; emit(out.join('\n') + '\n'); continue; }
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
      const lab = (p, kind) => p.items.filter(i => (kind === 'song') === (i.kind === 'song') && !STRUCTURAL.test(norm(i.label))).map(i => i.label);
      const songsA = multisetDiff(lab(ref, 'song'), lab(other, 'song')), songsB = multisetDiff(lab(other, 'song'), lab(ref, 'song'));
      const itemsA = multisetDiff(lab(ref, 'item'), lab(other, 'item')), itemsB = multisetDiff(lab(other, 'item'), lab(ref, 'item'));
      const keyDiffs = ref.items.filter(i => i.kind === 'song').map(i => {
        const o = other.items.find(x => x.kind === 'song' && norm(x.label) === norm(i.label));
        return o && o.key !== i.key ? `${i.label} (${i.key || '—'} vs ${o.key || '—'})` : null;
      }).filter(Boolean);
      if (songsA.length || songsB.length || keyDiffs.length) {
        tally.serviceDiffs++; changes++;
        say(`  ⚠ The services have DIFFERENT SONGS/KEYS in ChurchSuite — needs a decision (split the plan for this week?):`);
        if (songsA.length) say(`      songs only at ${nice(ref.serviceTime)}: ${songsA.join(', ')}`);
        if (songsB.length) say(`      songs only at ${nice(other.serviceTime)}: ${songsB.join(', ')}`);
        if (keyDiffs.length) say(`      different keys: ${keyDiffs.join(', ')}`);
      }
      if (itemsA.length || itemsB.length) {
        tally.itemOnlyDiffs++;
        say(`  ℹ Non-song items differ between services — would be marked on the one plan:`);
        if (itemsA.length) say(`      "${nice(ref.serviceTime)} only": ${itemsA.join(', ')}`);
        if (itemsB.length) say(`      "${nice(other.serviceTime)} only": ${itemsB.join(', ')}`);
      }
    }

    // --- songs (ChurchSuite first service vs SongStack)
    const ssSongs = sp.items.filter(i => i.type === 'song');
    const used = new Set(); const order = []; const songLines = []; const asSongIds = new Set();
    let csSongCount = 0;
    for (const s of ref.items) {
      if (s.kind !== 'song') {
        // A song entered as a general item in ChurchSuite (e.g. a carol under "Misc")?
        if (STRUCTURAL.test(norm(s.label))) continue;
        const idx = matchSong(s.label, ssSongs, used);
        if (idx < 0) continue;
        asSongIds.add(s.id); used.add(idx); order.push(idx); csSongCount++;
        songLines.push(`      ℹ ${s.label}: a general item in ChurchSuite, matched to SongStack song "${ssSongTitle(ssSongs[idx])}"`);
        continue;
      }
      csSongCount++;
      const idx = matchSong(s.label, ssSongs, used);
      if (idx < 0) { songLines.push(`      + ${s.label}  (in ChurchSuite, not in the SongStack plan)`); tally.songChanges++; changes++; continue; }
      used.add(idx); order.push(idx);
      const m = ssSongs[idx];
      const viaFirstLine = titleVariants(ssSongTitle(m)).every(v => !titleVariants(s.label).includes(v));
      if (viaFirstLine) songLines.push(`      ℹ ${s.label}: matched by first line to SongStack "${ssSongTitle(m)}"`);
      // Key rule (Jon, 2026-11-16): SongStack wins. A ChurchSuite key only fills a gap — no plan key AND no song default.
      if (s.key) {
        if (m.key && m.key !== s.key) songLines.push(`      ℹ ${s.label}: SongStack keeps key ${m.key} (ChurchSuite says ${s.key} — ignored)`);
        else if (!m.key && !m.default_key) { songLines.push(`      ~ ${s.label}: no key in SongStack → would set ${s.key} from ChurchSuite`); tally.keyChanges++; changes++; }
        else if (!m.key && m.default_key && m.default_key !== s.key) songLines.push(`      ℹ ${s.label}: SongStack uses song default ${m.default_key} (ChurchSuite says ${s.key} — ignored)`);
      }
    }
    ssSongs.forEach((s, i) => { if (!used.has(i)) { songLines.push(`      − ${ssSongTitle(s)}  (in SongStack, not in ChurchSuite — notes would be kept, item flagged)`); tally.songChanges++; changes++; } });
    const inOrder = order.every((v, i) => i === 0 || v > order[i - 1]);
    if (!inOrder) { songLines.push('      ↕ song order differs'); tally.songChanges++; changes++; }
    const realChanges = songLines.some(l => /^\s+[+~−↕]/.test(l));
    say(`  Songs: ${csSongCount} in ChurchSuite, ${ssSongs.length} in SongStack${realChanges ? '' : ' — ✓ same songs, same order'}`);
    songLines.forEach(l => say(l));

    // --- other items (labels differ between systems, so this is a rough guide)
    const csOther = ref.items.filter(i => i.kind !== 'song' && !asSongIds.has(i.id) && !STRUCTURAL.test(norm(i.label))).map(i => i.label);
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
        changes++;
        const nick = [...ssMus.values()].find(m => likelySamePerson(m.name, t.name))
          || [...members.values()].map(n => ({ name: n, member: true })).find(m => likelySamePerson(m.name, t.name));
        if (nick) { tally.nicknames.add(`${t.name} = ${nick.name}?`); say(`      ? ${t.name} — probably "${nick.name}"${nick.member ? ' (SongStack member)' : ' (on the SongStack plan)'} → would ask to confirm once, then remember${only}`); continue; }
        tally.peopleToAdd.add(t.name);
        if (members.has(k)) say(`      + ${t.name} — not on the SongStack plan; IS a SongStack member → would link to their account${only}`);
        else { tally.peopleNotMembers.add(t.name); say(`      + ${t.name} — not on the SongStack plan; NOT a SongStack member → would be added by name only${only}`); }
      }
    }
    for (const [k, m] of ssMus) if (!team.has(k) && ![...team.values()].some(t => likelySamePerson(t.name, m.name))) say(`      − ${m.name}${m.role ? ` (${m.role})` : ''} — on the SongStack plan, not on any ChurchSuite song item (would be kept)`);

    const others = new Set();
    for (const p of cps) for (const i of p.items) if (i.kind !== 'song') for (const n of i.people) if (!team.has(norm(n))) others.add(n);
    if (others.size) say(`  Other people in ChurchSuite (not music — would NOT be copied): ${others.size}`);

    if (!changes) tally.identical++;
    say(changes ? '' : '  → Already in step. A sync would change nothing.');
    emit(out.join('\n') + '\n');
  }

  emit('══ Summary ' + '═'.repeat(40));
  emit(`${tally.dates} dates · ${tally.identical} already in step · ${tally.songChanges} song add/remove/order differences · ${tally.keyChanges} keys ChurchSuite would fill in`);
  emit(`${tally.timeDiffs} time mismatches · ${tally.serviceDiffs} dates where the services have different songs/keys · ${tally.itemOnlyDiffs} where only non-song items differ`);
  emit(`Music team: ${tally.peopleToAdd.size} to add${tally.peopleNotMembers.size ? ` (${tally.peopleNotMembers.size} not SongStack members: ${[...tally.peopleNotMembers].join(', ')})` : ''}${tally.nicknames.size ? ` · to confirm: ${[...tally.nicknames].join('; ')}` : ''}`);

  const at = lines.findIndex(l => l.startsWith('══ Summary'));
  return { text: lines.join('\n'), summary: lines.slice(at + 1).join('\n') };
}

// Shared with churchsuite-sync.js so the sync matches exactly the way the report does.
module.exports = { buildReport, csServiceTime, matchSong, likelySamePerson, multisetDiff, ssSongTitle, ssSongVariants, STRUCTURAL };
