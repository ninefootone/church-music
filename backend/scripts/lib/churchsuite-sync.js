// ChurchSuite → SongStack sync, MINIMAL FIRST VERSION (Endcliffe only). See project doc churchsuite-integration.md.
//
// For each upcoming date that has ONE SongStack plan and one or more ChurchSuite plans:
//   • adds a ChurchSuite song missing from the SongStack plan — ONLY if it matches exactly one song in the
//     church's library by title, bracketed title or first line (never guessed)
//   • puts the plan's songs into ChurchSuite's order, using the slots songs already occupy
//     (non-song items stay exactly where they are)
//   • fills a key ONLY when the SongStack item has no key and the song has no default key
//   • adds music-team people (people on ChurchSuite song items) who aren't on the plan — exact names only;
//     linked to their account when they're a member
// It NEVER deletes or renames anything, never touches notes/content/arrangements/roles/status, never
// creates plans. Anything uncertain is returned as a note for the email. Every change is written to
// churchsuite_sync_log (with what it was before) so a run can be undone.
//
// apply = false runs everything inside a transaction and rolls it back: an exact preview.

const { norm, titleVariants } = require('./churchsuite');
const { csServiceTime, matchSong, likelySamePerson, ssSongVariants, STRUCTURAL } = require('./churchsuite-report');

const londonToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const DEFAULT_ROLE = 'Musician';

async function planItems(client, planId) {
  const r = await client.query(
    `SELECT pi.id, pi.type, pi.phase, pi.title, pi.position, pi.key_override,
            s.id AS song_id, s.title AS song, s.first_line, s.default_key
       FROM plan_items pi LEFT JOIN songs s ON s.id = pi.song_id
      WHERE pi.plan_id = $1 ORDER BY pi.position, pi.id`, [planId]);
  return r.rows;
}

// Library songs that confidently match a ChurchSuite title (exact / bracket variant / first line).
function libraryMatches(title, library) {
  const cv = titleVariants(title);
  const exact = library.filter(s => titleVariants(s.song)[0] === cv[0]);
  if (exact.length) return exact;
  return library.filter(s => ssSongVariants(s).some(v => cv.includes(v)));
}

async function applySync({ pool, cs, churchId, from, to, apply, runId }) {
  const actions = [];   // { date, text }
  const notes = [];     // { date, text }
  const today = londonToday();
  const start = from > today ? from : today;

  const library = (await pool.query(
    `SELECT id, title AS song, first_line, default_key, default_duration
       FROM songs WHERE church_id = $1 AND (retired = FALSE OR retired IS NULL)`, [churchId])).rows;
  const members = (await pool.query(
    `SELECT u.id AS user_id, u.name, m.default_roles
       FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.church_id = $1 AND m.role <> 'revoked' AND u.name IS NOT NULL`, [churchId])).rows;
  const ssPlans = (await pool.query(
    `SELECT id, to_char(plan_date, 'YYYY-MM-DD') AS date FROM plans
      WHERE church_id = $1 AND plan_date BETWEEN $2::date AND $3::date`, [churchId, start, to])).rows;

  const csPlans = await cs.plans(start, to);
  for (const p of csPlans) { p.items = await cs.planItems(p.id); p.serviceTime = csServiceTime(p, p.items); }

  const dates = [...new Set(csPlans.map(p => p.date))].sort();
  for (const date of dates) {
    const cps = csPlans.filter(p => p.date === date).sort((a, b) => a.serviceTime.localeCompare(b.serviceTime));
    const sps = ssPlans.filter(p => p.date === date);
    const note = text => notes.push({ date, text });
    const act = text => actions.push({ date, text });
    if (!sps.length) { note('Only in ChurchSuite — no SongStack plan to update (creating plans comes later).'); continue; }
    if (sps.length > 1) { note(`${sps.length} SongStack plans on this date — skipped (not sure which to update).`); continue; }

    // Services must have the same songs and keys, or one plan can't represent them — leave it to a person.
    const songSig = p => p.items.filter(i => i.kind === 'song').map(i => `${norm(i.label)}|${i.key}`).join(';');
    if (cps.some(p => songSig(p) !== songSig(cps[0]))) { note('Services have different songs or keys in ChurchSuite — skipped, needs a decision.'); continue; }

    const ref = cps[0];
    const planId = sps[0].id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM plans WHERE id = $1 FOR UPDATE', [planId]);
      const log = (action, detail) => client.query(
        'INSERT INTO churchsuite_sync_log (run_id, church_id, plan_id, action, detail) VALUES ($1,$2,$3,$4,$5)',
        [runId, churchId, planId, action, detail]);

      // 1. Match ChurchSuite songs (and general items that are really songs) to the plan's songs, in order.
      let items = await planItems(client, planId);
      let ssSongs = items.filter(i => i.type === 'song');
      const used = new Set();
      const seq = [];   // { cs, itemId|null, add: libSong|null }
      for (const c of ref.items) {
        if (c.kind !== 'song' && STRUCTURAL.test(norm(c.label))) continue;
        const idx = matchSong(c.label, ssSongs, used);
        if (idx >= 0) { used.add(idx); seq.push({ cs: c, itemId: ssSongs[idx].id }); continue; }
        if (c.kind !== 'song') continue;                       // an ordinary service item
        const cand = libraryMatches(c.label, library);
        if (cand.length === 1) seq.push({ cs: c, itemId: null, add: cand[0] });
        else note(cand.length ? `"${c.label}" matches ${cand.length} library songs (${cand.map(s => s.song).join(', ')}) — not added.`
                              : `"${c.label}" isn't in the SongStack library (or only matches loosely) — not added.`);
      }
      ssSongs.forEach((s, i) => { if (!used.has(i)) note(`"${s.song || s.title}" is in the SongStack plan but not in ChurchSuite — left alone.`); });

      // 2. Add missing songs (at the end for now — step 3 puts them in the right place).
      for (const e of seq.filter(x => x.add)) {
        const max = await client.query('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM plan_items WHERE plan_id = $1', [planId]);
        const ins = await client.query(
          `INSERT INTO plan_items (plan_id, type, song_id, title, notes, content, position, duration_minutes, phase)
           VALUES ($1, 'song', $2, NULL, NULL, NULL, $3, $4, 'service') RETURNING id`,
          [planId, e.add.id, max.rows[0].p, e.add.default_duration || null]);
        e.itemId = ins.rows[0].id;
        await log('add_song', { item_id: e.itemId, song_id: e.add.id, title: e.add.song });
        act(`Added "${e.add.song}"${norm(e.add.song) !== norm(e.cs.label) ? ` (ChurchSuite: "${e.cs.label}")` : ''}`);
      }

      // 3. Place songs as ChurchSuite has them, relative to the non-song items both plans share
      //    ("after Children's slot, before Children leave"). A song only moves when it's on the wrong side of
      //    one of those markers, or out of order with the songs around it. Non-song items never move.
      items = await planItems(client, planId);
      const songIds = new Set(seq.filter(x => x.itemId).map(x => x.itemId));
      const pre = items.filter(i => i.phase === 'pre-service' && !songIds.has(i.id));
      const svc = items.filter(i => i.phase !== 'pre-service' || songIds.has(i.id));
      const skeleton = svc.filter(i => !songIds.has(i.id));            // everything that stays put
      const label = i => norm(i.title || i.song || '');
      // Which skeleton item each song currently sits after (-1 = before all of them).
      const curGap = new Map(); let g = -1;
      for (const i of svc) { if (songIds.has(i.id)) curGap.set(i.id, g); else g = skeleton.indexOf(i); }
      // Walk ChurchSuite's order, pairing its non-song items with the skeleton (in order, by name).
      const seqByCs = new Map(seq.filter(x => x.itemId).map(x => [x.cs.id, x]));
      const plan = [];                                              // { id, A } in ChurchSuite order
      let anchor = -1;
      for (const c of ref.items) {
        const e = seqByCs.get(c.id);
        if (e) { plan.push({ id: e.itemId, A: anchor }); continue; }
        const k = skeleton.findIndex((x, idx) => idx > anchor && label(x) && label(x) === norm(c.label));
        if (k >= 0) { anchor = k; plan.forEach(pp => { if (pp.B === undefined) pp.B = k; }); }
      }
      plan.forEach(pp => { if (pp.B === undefined) pp.B = skeleton.length; });
      // Keep each song where it is if that's allowed; otherwise put it straight after its marker.
      let prevGap = -1;
      for (const pp of plan) {
        const cur = curGap.has(pp.id) && !seq.find(x => x.itemId === pp.id).add ? curGap.get(pp.id) : null;
        let gap = cur !== null && cur >= pp.A && cur <= pp.B - 1 ? cur : pp.A;
        if (gap < prevGap) gap = prevGap;
        pp.gap = gap; prevGap = gap;
      }
      const order = [...pre];
      for (const pp of plan.filter(x => x.gap === -1)) order.push(svc.find(i => i.id === pp.id));
      skeleton.forEach((sk, k) => { order.push(sk); for (const pp of plan.filter(x => x.gap === k)) order.push(svc.find(i => i.id === pp.id)); });
      const before = Object.fromEntries(items.map(i => [i.id, i.position]));
      const oldSeq = items.filter(i => !seq.find(x => x.add && x.itemId === i.id)).map(i => i.id).join();
      const newSeq = order.filter(i => !seq.find(x => x.add && x.itemId === i.id)).map(i => i.id).join();
      if (order.some((i, k) => before[i.id] !== k)) {
        await client.query(
          `UPDATE plan_items pi SET position = o.pos FROM unnest($2::uuid[], $3::int[]) AS o(id, pos)
            WHERE pi.id = o.id AND pi.plan_id = $1`, [planId, order.map(i => i.id), order.map((_, k) => k)]);
        await log('reorder', { before });
        if (oldSeq !== newSeq) act(`Songs moved to match ChurchSuite: ${order.filter(i => songIds.has(i.id)).map(i => i.song).join(' → ')}`);
      }

      // 4. Keys — SongStack wins; ChurchSuite only fills a gap.
      items = await planItems(client, planId);
      for (const e of seq.filter(x => x.itemId && x.cs.key)) {
        const it = items.find(i => i.id === e.itemId);
        if (it.key_override || it.default_key) continue;
        await client.query('UPDATE plan_items SET key_override = $1 WHERE id = $2 AND key_override IS NULL', [e.cs.key, it.id]);
        await log('set_key', { item_id: it.id, key: e.cs.key });
        act(`Key ${e.cs.key} set for "${it.song}" (it had none)`);
      }

      // 5. Music team — exact names only; nicknames and anyone ambiguous go in the notes.
      const mus = (await client.query('SELECT id, name, user_id FROM plan_musicians WHERE plan_id = $1', [planId])).rows;
      const team = new Map();
      for (const p of cps) for (const i of p.items) if (i.kind === 'song') for (const n of i.people) if (!team.has(norm(n))) team.set(norm(n), n);
      for (const [k, name] of team) {
        if (mus.some(m => norm(m.name) === k)) continue;
        const nick = mus.find(m => likelySamePerson(m.name, name)) || members.find(m => likelySamePerson(m.name, name));
        if (nick) { note(`${name} — probably "${nick.name}", not added (needs confirming).`); continue; }
        const mem = members.filter(m => norm(m.name) === k);
        if (mem.length > 1) { note(`${name} — ${mem.length} members have that name, not added.`); continue; }
        const role = (mem[0] && mem[0].default_roles && mem[0].default_roles[0]) || DEFAULT_ROLE;
        const ins = await client.query(
          'INSERT INTO plan_musicians (plan_id, user_id, name, role) VALUES ($1,$2,$3,$4) RETURNING id',
          [planId, mem[0] ? mem[0].user_id : null, mem[0] ? mem[0].name : name, role]);
        await log('add_musician', { musician_id: ins.rows[0].id, name, linked: !!mem[0] });
        act(`Added ${name} to the music team as ${role}${mem[0] ? ' (linked to their account)' : ' (name only — not a SongStack member)'}`);
      }

      await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      note(`Error while syncing this date — nothing changed for it: ${e.message}`);
    } finally {
      client.release();
    }
  }
  return { actions, notes };
}

// Plain-text summary for the email.
function formatSync({ actions, notes }, apply) {
  const byDate = new Map();
  for (const a of actions) (byDate.get(a.date) || byDate.set(a.date, { a: [], n: [] }).get(a.date)).a.push(a.text);
  for (const n of notes) (byDate.get(n.date) || byDate.set(n.date, { a: [], n: [] }).get(n.date)).n.push(n.text);
  const out = [];
  for (const [date, { a, n }] of [...byDate].sort()) {
    out.push(date);
    a.forEach(t => out.push(`  ${apply ? '✓' : '→'} ${t}`));
    n.forEach(t => out.push(`  ℹ ${t}`));
  }
  return out.join('\n') || (apply ? 'Nothing to change.' : 'A sync would change nothing.');
}

module.exports = { applySync, formatSync };
