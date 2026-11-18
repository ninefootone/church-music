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
//
// Item 3 (2026-11-18): answers given once on Settings → ChurchSuite are used here — churchsuite_people (ChurchSuite
// person → member / name only / ignore) and churchsuite_songs (ChurchSuite song → library song / ignore). Anything
// still uncertain becomes a QUESTION (churchsuite_questions, recordQuestions = true) as well as an email note:
// person, song, removed_song (in the SongStack plan, not in ChurchSuite), removed_musician. A removed_* question
// answered "keep" stops being raised for that item.

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

async function applySync({ pool, cs, churchId, from, to, apply, runId, recordQuestions = false }) {
  const actions = [];   // { date, text }
  const notes = [];     // { date, text }
  const questions = new Map();   // `${kind}|${key}` → { kind, key, planId, date, payload }
  const ask = (kind, key, date, planId, payload) => {
    const k = `${kind}|${key}`;
    const q = questions.get(k);
    if (q) { if (!q.payload.dates.includes(date)) q.payload.dates.push(date); return; }
    questions.set(k, { kind, key, planId, date, payload: { ...payload, dates: [date] } });
  };
  const today = londonToday();
  const start = from > today ? from : today;

  const library = (await pool.query(
    `SELECT id, title AS song, first_line, default_key, default_duration
       FROM songs WHERE church_id = $1 AND (retired = FALSE OR retired IS NULL)`, [churchId])).rows;
  const members = (await pool.query(
    `SELECT u.id AS user_id, u.name, m.default_roles
       FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.church_id = $1 AND m.role <> 'revoked' AND u.name IS NOT NULL`, [churchId])).rows;
  // Answers given once on Settings → ChurchSuite.
  const peopleAnswers = new Map((await pool.query(
    'SELECT cs_key, decision, user_id FROM churchsuite_people WHERE church_id = $1', [churchId])).rows.map(x => [x.cs_key, x]));
  const songAnswers = new Map((await pool.query(
    'SELECT cs_key, decision, song_id FROM churchsuite_songs WHERE church_id = $1', [churchId])).rows.map(x => [x.cs_key, x]));
  const kept = new Set((await pool.query(
    `SELECT kind || '|' || q_key AS k FROM churchsuite_questions
      WHERE church_id = $1 AND status = 'answered' AND answer = 'keep'`, [churchId])).rows.map(x => x.k));
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
        const answer = c.ref ? songAnswers.get(c.ref) : null;
        if (answer && answer.decision === 'ignore') continue;  // "ignore this ChurchSuite item"
        const answered = answer && answer.decision === 'song' ? library.find(sg => sg.id === answer.song_id) : null;
        let idx = answered ? ssSongs.findIndex((sg, i) => !used.has(i) && sg.song_id === answered.id) : -1;
        if (idx < 0) idx = matchSong(c.label, ssSongs, used);
        if (idx >= 0) { used.add(idx); seq.push({ cs: c, itemId: ssSongs[idx].id }); continue; }
        if (c.kind !== 'song') continue;                       // an ordinary service item
        if (answered) { seq.push({ cs: c, itemId: null, add: answered }); continue; }
        const cand = libraryMatches(c.label, library);
        if (cand.length === 1) { seq.push({ cs: c, itemId: null, add: cand[0] }); continue; }
        note(cand.length ? `"${c.label}" matches ${cand.length} library songs (${cand.map(sg => sg.song).join(', ')}) — not added.`
                         : `"${c.label}" isn't in the SongStack library (or only matches loosely) — not added.`);
        if (c.ref) ask('song', c.ref, date, null, { title: c.label, candidates: cand.map(sg => ({ id: sg.id, title: sg.song })) });
      }
      ssSongs.forEach((sg, i) => {
        if (used.has(i) || kept.has(`removed_song|item:${sg.id}`)) return;
        note(`"${sg.song || sg.title}" is in the SongStack plan but not in ChurchSuite — left alone.`);
        ask('removed_song', `item:${sg.id}`, date, planId, { title: sg.song || sg.title || 'Song', item_id: sg.id });
      });

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
      const team = new Map();   // normalised name → { name, key }
      for (const p of cps) for (const i of p.items) if (i.kind === 'song') for (const pr of (i.peopleRefs || i.people.map(n => ({ name: n, key: null })))) {
        if (!team.has(norm(pr.name))) team.set(norm(pr.name), pr);
      }
      const accounted = new Set();   // plan_musicians ids that correspond to someone in ChurchSuite
      for (const [k, { name, key: pkey }] of team) {
        const answer = pkey ? peopleAnswers.get(pkey) : null;
        const onPlan = mus.find(m => norm(m.name) === k);
        if (onPlan) { accounted.add(onPlan.id); }
        if (answer && answer.decision === 'ignore') continue;             // "never add this person"
        if (answer && answer.decision === 'member') {
          const mem = members.find(m => m.user_id === answer.user_id);
          if (mem) {
            const already = mus.find(m => m.user_id === mem.user_id || norm(m.name) === norm(mem.name));
            if (already) { accounted.add(already.id); continue; }
            const role = (mem.default_roles && mem.default_roles[0]) || DEFAULT_ROLE;
            const ins = await client.query(
              'INSERT INTO plan_musicians (plan_id, user_id, name, role) VALUES ($1,$2,$3,$4) RETURNING id',
              [planId, mem.user_id, mem.name, role]);
            accounted.add(ins.rows[0].id);
            await log('add_musician', { musician_id: ins.rows[0].id, name, linked: true });
            act(`Added ${mem.name} to the music team as ${role} (ChurchSuite: ${name}; linked to their account)`);
            continue;
          }
          // The member has left the church since — fall through and ask again.
        }
        if (onPlan) continue;
        if (answer && answer.decision === 'name_only') {
          const ins = await client.query(
            'INSERT INTO plan_musicians (plan_id, user_id, name, role) VALUES ($1,NULL,$2,$3) RETURNING id', [planId, name, DEFAULT_ROLE]);
          accounted.add(ins.rows[0].id);
          await log('add_musician', { musician_id: ins.rows[0].id, name, linked: false });
          act(`Added ${name} to the music team as ${DEFAULT_ROLE} (name only — as you chose)`);
          continue;
        }
        const nick = mus.find(m => likelySamePerson(m.name, name)) || members.find(m => likelySamePerson(m.name, name));
        if (nick) {
          if (nick.id && mus.includes(nick)) accounted.add(nick.id);
          note(`${name} — probably "${nick.name}", not added (needs confirming).`);
          if (pkey) ask('person', pkey, date, null, { name, suggestion: members.includes(nick) ? { user_id: nick.user_id, name: nick.name } : null,
            candidates: members.filter(m => likelySamePerson(m.name, name)).map(m => ({ user_id: m.user_id, name: m.name })) });
          continue;
        }
        const mem = members.filter(m => norm(m.name) === k);
        if (mem.length > 1) {
          note(`${name} — ${mem.length} members have that name, not added.`);
          if (pkey) ask('person', pkey, date, null, { name, suggestion: null, candidates: mem.map(m => ({ user_id: m.user_id, name: m.name })) });
          continue;
        }
        const role = (mem[0] && mem[0].default_roles && mem[0].default_roles[0]) || DEFAULT_ROLE;
        const ins = await client.query(
          'INSERT INTO plan_musicians (plan_id, user_id, name, role) VALUES ($1,$2,$3,$4) RETURNING id',
          [planId, mem[0] ? mem[0].user_id : null, mem[0] ? mem[0].name : name, role]);
        accounted.add(ins.rows[0].id);
        await log('add_musician', { musician_id: ins.rows[0].id, name, linked: !!mem[0] });
        act(`Added ${name} to the music team as ${role}${mem[0] ? ' (linked to their account)' : ' (name only — not a SongStack member)'}`);
      }
      // Musicians on the SongStack plan who aren't on any ChurchSuite song item. Only asked once ChurchSuite has a
      // music team for the date (an empty team usually just means the rota isn't done yet).
      // Every plan row counts, not just the first: someone on the plan twice (Vocals AND Keys) is two rows.
      const teamUsers = new Set([...team.values()].map(t => t.key && peopleAnswers.get(t.key))
        .filter(x => x && x.decision === 'member').map(x => x.user_id));
      if (team.size) for (const m of mus) {
        if (accounted.has(m.id) || kept.has(`removed_musician|musician:${m.id}`)) continue;
        if (team.has(norm(m.name)) || (m.user_id && teamUsers.has(m.user_id))) continue;
        if ([...team.values()].some(t => likelySamePerson(t.name, m.name))) continue;
        ask('removed_musician', `musician:${m.id}`, date, planId, { name: m.name, musician_id: m.id });
      }

      await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      note(`Error while syncing this date — nothing changed for it: ${e.message}`);
    } finally {
      client.release();
    }
  }
  if (recordQuestions) await saveQuestions(pool, churchId, [...questions.values()]);
  return { actions, notes, questions: [...questions.values()] };
}

// Upserts this run's questions and closes open ones the run no longer raised (the cause went away — e.g. the song
// was fixed in ChurchSuite, or the plan is now in the past). A question the sync raises is always unresolved (an
// answer stops it being raised), so a raised question is (re)opened even if it was answered before — e.g. the member
// it was matched to has left, or the answer was forgotten on Settings → ChurchSuite.
async function saveQuestions(pool, churchId, qs) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const seen = [];
    for (const q of qs) {
      const r = await client.query(
        `INSERT INTO churchsuite_questions (church_id, kind, q_key, plan_id, plan_date, payload)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (church_id, kind, q_key) DO UPDATE
           SET payload = EXCLUDED.payload, plan_id = EXCLUDED.plan_id, plan_date = EXCLUDED.plan_date, last_seen = now(),
               status = 'open', answer = NULL
         RETURNING id`,
        [churchId, q.kind, q.key, q.planId, q.date, q.payload]);
      seen.push(r.rows[0].id);
    }
    await client.query(
      `UPDATE churchsuite_questions SET status = 'gone'
        WHERE church_id = $1 AND status = 'open' AND NOT (id = ANY($2::uuid[]))`, [churchId, seen]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
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
