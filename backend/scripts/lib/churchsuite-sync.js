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
// Item 4a (2026-11-18): a date with ChurchSuite plans but NO SongStack plan gets one created automatically
// (createPlan below): one plan for all that day's services (start time + extra times), the whole running order
// (songs, service items with liturgy words — set-up/rehearsal items left out), anything at only some services marked
// with service_times ("9:15 only"), keys from ChurchSuite, then the music team as for any plan. Title from the plan
// template with the same start time, else ChurchSuite's plan name. Published only if every ChurchSuite service that
// day is published. Logged as 'create_plan' with a fingerprint, so undo-last-run deletes it if nobody has edited it.
//
// Item 3 (2026-11-18): answers given once on Settings → ChurchSuite are used here — churchsuite_people (ChurchSuite
// person → member / name only / ignore) and churchsuite_songs (ChurchSuite song → library song / ignore). Anything
// still uncertain becomes a QUESTION (churchsuite_questions, recordQuestions = true) as well as an email note:
// person, song, removed_song (in the SongStack plan, not in ChurchSuite), removed_musician. A removed_* question
// answered "keep" stops being raised for that item.

const crypto = require('crypto');
const { norm, titleVariants } = require('./churchsuite');
const { csServiceTime, matchSong, likelySamePerson, ssSongVariants, STRUCTURAL } = require('./churchsuite-report');
// NB the Railway cron service installs only the ROOT package.json (pg, dotenv…) — don't require backend modules that
// need other npm packages (utils/sanitize needs sanitize-html → crashed the job on 2026-11-18).
const { formatClock } = require('../../utils/extraTimes');

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

// ChurchSuite's services for one date merged into one running order: [{ item, times: ['09:15', …] }]. Items are
// paired across services by kind + name, in order; an item missing from a service just lacks that time.
function mergeServices(cps) {
  const keyOf = i => `${i.kind}|${norm(i.label)}`;
  const merged = [];
  for (const p of cps) {
    let last = -1;
    for (const it of p.items) {
      if (it.kind !== 'song' && STRUCTURAL.test(norm(it.label))) continue;
      const k = keyOf(it);
      let idx = merged.findIndex((e, j) => j > last && e.key === k && !e.times.includes(p.serviceTime));
      if (idx < 0) { idx = last + 1; merged.splice(idx, 0, { key: k, item: it, times: [] }); }
      if (!merged[idx].times.includes(p.serviceTime)) merged[idx].times.push(p.serviceTime);
      last = idx;
    }
  }
  return merged;
}

// Liturgy words (plain text from ChurchSuite) → the simple HTML service-item content uses. Every character of the
// text is escaped, so the only tags are the <p>/<br> added here (no sanitizer needed).
function wordsToHtml(text) {
  if (!text || !String(text).trim()) return null;
  const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return String(text).replace(/\r/g, '').trim().split(/\n\s*\n/)
    .map(par => `<p>${esc(par.trim()).split('\n').join('<br>')}</p>`).join('');
}

const sameKeyName = (a, b) => (a || '').trim().replace(/♯/g, '#').replace(/♭/g, 'b').toLowerCase() === (b || '').trim().replace(/♯/g, '#').replace(/♭/g, 'b').toLowerCase();

// Creates the SongStack plan for a date that only exists in ChurchSuite (inside the date's transaction).
async function createPlan(client, { churchId, date, cps, library, songAnswers, ask }) {
  const times = [...new Set(cps.map(p => p.serviceTime).filter(Boolean))].sort();
  const start = times[0] || null;
  const extra = times.slice(1);
  const tpl = start ? (await client.query(
    `SELECT title FROM plan_templates WHERE church_id = $1 AND plan_start_time = $2::time AND title IS NOT NULL AND title <> ''
      ORDER BY (extra_times = $3::time[]) DESC, name LIMIT 1`, [churchId, start, extra])).rows[0] : null;
  const title = (tpl && tpl.title) || cps[0].name || null;
  const status = cps.every(p => p.status === 'published') ? 'published' : 'draft';
  const creator = (await client.query(
    `SELECT u.clerk_id FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.church_id = $1 AND m.role = 'admin' ORDER BY m.joined_at NULLS LAST LIMIT 1`, [churchId])).rows[0];
  const plan = (await client.query(
    `INSERT INTO plans (church_id, plan_date, plan_time, plan_start_time, plan_sort_order, title, public_token, created_by, status, extra_times)
     VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9) RETURNING id`,
    [churchId, date, start ? formatClock(start) : null, start, title, crypto.randomUUID(), creator ? creator.clerk_id : null, status, extra])).rows[0];

  let pos = 0, songs = 0, slots = 0;
  for (const { item: c, times: at } of mergeServices(cps)) {
    const serviceTimes = start && at.length < times.length ? at.filter(Boolean) : [];
    const answer = c.ref ? songAnswers.get(c.ref) : null;
    if (answer && answer.decision === 'ignore') continue;
    let song = answer && answer.decision === 'song' ? library.find(sg => sg.id === answer.song_id) : null;
    if (!song && c.ref) {
      const cand = libraryMatches(c.label, library);
      if (cand.length === 1) song = cand[0];
      else if (c.kind === 'song') ask('song', c.ref, date, null, { title: c.label, candidates: cand.map(sg => ({ id: sg.id, title: sg.song })) });
    }
    if (song) {
      const key = c.key && !sameKeyName(c.key, song.default_key) ? c.key : null;
      await client.query(
        `INSERT INTO plan_items (plan_id, type, song_id, position, key_override, duration_minutes, phase, service_times)
         VALUES ($1, 'song', $2, $3, $4, $5, 'service', $6)`, [plan.id, song.id, pos++, key, song.default_duration || null, serviceTimes]);
      songs++;
    } else if (c.kind === 'song') {
      await client.query(
        `INSERT INTO plan_items (plan_id, type, title, position, phase, service_times) VALUES ($1, 'song_slot', $2, $3, 'service', $4)`,
        [plan.id, c.label, pos++, serviceTimes]);
      slots++;
    } else {
      await client.query(
        `INSERT INTO plan_items (plan_id, type, title, content, position, phase, service_times) VALUES ($1, 'custom', $2, $3, $4, 'service', $5)`,
        [plan.id, c.label, wordsToHtml(c.words), pos++, serviceTimes]);
    }
  }
  return { planId: plan.id, title, status, times, items: pos, songs, slots };
}

// Fingerprint of a plan's items + musicians (same SQL in the undo script): undo only deletes a plan the sync
// created if this still matches, i.e. nobody has edited it since.
const PLAN_FINGERPRINT_SQL = `SELECT md5(
  COALESCE((SELECT string_agg(ROW(id, type, song_id, title, notes, content, key_override, position, custom_arrangement,
                                  duration_minutes, phase, service_times)::text, '|' ORDER BY position, id)
              FROM plan_items WHERE plan_id = $1), '') || '#' ||
  COALESCE((SELECT string_agg(ROW(id, name, role, user_id)::text, '|' ORDER BY id::text)
              FROM plan_musicians WHERE plan_id = $1), '')) AS fp`;

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
    const creating = !sps.length;   // item 4a: only in ChurchSuite → create the SongStack plan
    if (sps.length > 1) { note(`${sps.length} SongStack plans on this date — skipped (not sure which to update).`); continue; }

    // Services must have the same songs and keys, or one plan can't represent them — leave it to a person.
    // (A plan being CREATED handles different services itself, with per-service items.)
    const songSig = p => p.items.filter(i => i.kind === 'song').map(i => `${norm(i.label)}|${i.key}`).join(';');
    if (!creating && cps.some(p => songSig(p) !== songSig(cps[0]))) { note('Services have different songs or keys in ChurchSuite — skipped, needs a decision.'); continue; }

    const ref = cps[0];
    let planId = creating ? null : sps[0].id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let created = null;
      if (creating) {
        created = await createPlan(client, { churchId, date, cps, library, songAnswers, ask });
        planId = created.planId;
      } else {
        await client.query('SELECT id FROM plans WHERE id = $1 FOR UPDATE', [planId]);
      }
      const log = (action, detail) => client.query(
        'INSERT INTO churchsuite_sync_log (run_id, church_id, plan_id, action, detail) VALUES ($1,$2,$3,$4,$5)',
        [runId, churchId, planId, action, detail]);
      if (created) {
        await log('create_plan', { title: created.title, status: created.status });
        act(`Created the plan "${created.title || 'Untitled'}" (${created.status}${created.times.length ? `, ${created.times.map(formatClock).join(' & ')}` : ''}): `
          + `${created.items} item(s), ${created.songs} song(s)${created.slots ? `, ${created.slots} song(s) to be chosen` : ''}`);
      }

      // Steps 1–4 bring an EXISTING plan's songs into line. A plan created just now already matches ChurchSuite
      // (and may have per-service songs the first service doesn't have), so it goes straight to the music team.
      if (!created) {

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

      }   // end of steps 1–4 (existing plans only)

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
        // Someone with a likely-same name already on the plan ("Sam" for ChurchSuite's "Samuel"): an answer only
        // decides who they are, never adds a second copy of them.
        const nickOnPlan = onPlan ? null : mus.find(m => likelySamePerson(m.name, name));
        if (answer && answer.decision === 'ignore') continue;             // "never add this person"
        if (answer && answer.decision === 'member') {
          const mem = members.find(m => m.user_id === answer.user_id);
          if (mem) {
            const already = mus.find(m => m.user_id === mem.user_id || norm(m.name) === norm(mem.name)) || nickOnPlan;
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
        if (answer && answer.decision === 'name_only' && nickOnPlan) { accounted.add(nickOnPlan.id); continue; }
        // "Not a member yet": once exactly one member has this exact name (they've joined), link them as usual.
        if (answer && answer.decision === 'name_only' && members.filter(m => norm(m.name) === k).length !== 1) {
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
            on_plan: mus.includes(nick) ? nick.name : null,
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

      if (created) {   // fingerprint for undo (see PLAN_FINGERPRINT_SQL)
        const fp = (await client.query(PLAN_FINGERPRINT_SQL, [planId])).rows[0].fp;
        await client.query(
          `UPDATE churchsuite_sync_log SET detail = detail || jsonb_build_object('fp', $3::text)
            WHERE run_id = $1 AND plan_id = $2 AND action = 'create_plan'`, [runId, planId, fp]);
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

module.exports = { applySync, formatSync, mergeServices, PLAN_FINGERPRINT_SQL };
