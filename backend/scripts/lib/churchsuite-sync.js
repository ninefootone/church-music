// ChurchSuite → SongStack sync (Endcliffe for now). See project doc churchsuite-integration.md.
//
// TRUTH MODEL (Jon, 2026-11-19): for a church using ChurchSuite, ChurchSuite is where the plan's truth is; SongStack
// manages what ChurchSuite doesn't (files, charts, recordings, markings, arrangements, notes).
//
// Which SongStack plan a ChurchSuite date controls: the plan whose START TIME is one of ChurchSuite's service times
// that day (a plan with no start time counts only if it's the only plan that day; if ChurchSuite's plan names have no
// times, the only plan that day). Other SongStack plans on that date — e.g. an evening service made in SongStack only —
// are never touched. No controlled plan → one is CREATED. Two → skipped with a note. Dates ChurchSuite has nothing
// for are never looked at.
//
// For a controlled (or just-created) plan, reconcile() makes it match ChurchSuite (all services merged):
//   • service times = ChurchSuite's (start + extra times) — 'set_plan_times'
//   • the running order (songs, song slots, service items; ChurchSuite set-up/rehearsal items ignored) is added to,
//     REMOVED from and put in ChurchSuite's order — 'add_song' / 'add_item' / 'remove_item' / 'reorder'
//   • which services each item is at = ChurchSuite's — 'set_services'
//   • keys: SongStack's plan key wins; ChurchSuite's key only fills a plan key that isn't set (a song's library
//     default isn't a plan decision) — 'set_key'
//   • lengths and liturgy words only fill gaps — 'set_item'
//   • NEVER touched: pre-service items, notes, arrangements, titles of existing items, plan title/status/notes.
//   • the music team: added (people on ChurchSuite song items + empty song slots; answers on Settings → ChurchSuite)
//     and REMOVED when not in ChurchSuite (only when ChurchSuite has a team that date; likely-same names count as
//     present) — 'add_musician' / 'remove_musician'
//   • items/musicians an admin chose to KEEP (old "Keep" answers) are never removed.
// Every change is logged in churchsuite_sync_log with what it was before (removed rows in full), so
// backend/migrations/2026-11-17-churchsuite-undo-last-run.sql can put a run back. apply = false = exact preview
// (transaction rolled back). Uncertain matches → questions on Settings → ChurchSuite (person / song).

const crypto = require('crypto');
const { norm, titleVariants } = require('./churchsuite');
const { csServiceTime, matchSong, likelySamePerson, ssSongVariants, STRUCTURAL } = require('./churchsuite-report');
// NB the Railway cron service installs only the ROOT package.json (pg, dotenv…) — don't require backend modules that
// need other npm packages (utils/sanitize needs sanitize-html → crashed the job on 2026-11-18).
const { formatClock } = require('../../utils/extraTimes');

const londonToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const DEFAULT_ROLE = 'Musician';

// Full plan item rows (for matching, updating and — when removed — logging in full so undo can restore them).
async function planRows(client, planId) {
  const r = await client.query(
    `SELECT pi.*, ARRAY(SELECT to_char(t, 'HH24:MI') FROM unnest(pi.service_times) t ORDER BY t) AS st,
            s.title AS song, s.first_line, s.default_key, s.default_duration
       FROM plan_items pi LEFT JOIN songs s ON s.id = pi.song_id
      WHERE pi.plan_id = $1 ORDER BY pi.position, pi.id`, [planId]);
  return r.rows;
}
// The row as stored (for the log, so undo can put it back exactly): every plan_items column — pi.* minus the
// joined helper fields. (Whitelisting columns would leave any other NOT NULL column empty on restore.)
const JOINED = new Set(['st', 'song', 'first_line', 'default_key', 'default_duration']);
const storedRow = r => Object.fromEntries(Object.entries(r).filter(([c]) => !JOINED.has(c)));

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
const minutesOf = c => (c.duration ? Math.max(1, Math.round(c.duration / 60)) : null);   // ChurchSuite length is seconds

// The plan row for a date that only exists in ChurchSuite. Its running order is then filled by reconcile().
// Title from the plan template with the same start time (else ChurchSuite's plan name); published only if every
// ChurchSuite service that day is published.
async function createPlanRow(client, { churchId, date, cps, times }) {
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
  return { planId: plan.id, title, status };
}

// Fingerprint of a plan's items + musicians (same SQL in the undo script): undo only deletes a plan the sync
// created if this still matches, i.e. nobody has edited it since.
const PLAN_FINGERPRINT_SQL = `SELECT md5(
  COALESCE((SELECT string_agg(ROW(id, type, song_id, title, notes, content, key_override, position, custom_arrangement,
                                  duration_minutes, phase, service_times)::text, '|' ORDER BY position, id)
              FROM plan_items WHERE plan_id = $1), '') || '#' ||
  COALESCE((SELECT string_agg(ROW(id, name, role, user_id)::text, '|' ORDER BY id::text)
              FROM plan_musicians WHERE plan_id = $1), '')) AS fp`;

// Makes one SongStack plan's running order match ChurchSuite (see the header). quiet = a plan created this run:
// its individual additions aren't listed in the email (the "Created the plan" line covers them).
async function reconcile(client, ctx) {
  const { planId, cps, times, library, songAnswers, kept, ask, act, note, date, quiet } = ctx;
  let changes = 0;
  const log = (action, detail) => { changes++; return ctx.log(action, detail); };
  const say = text => { if (!quiet) act(text); };
  const want = at => (times.length && at.length < times.length ? [...at].filter(Boolean).sort() : []);
  const entries = mergeServices(cps);

  // Same song, different keys in different services → the first service's key is used.
  const keysBy = new Map();
  for (const p of cps) for (const i of p.items) if (i.kind === 'song' && i.key) {
    const k = norm(i.label); if (!keysBy.has(k)) keysBy.set(k, { label: i.label, keys: [] });
    keysBy.get(k).keys.push(`${i.key} at ${formatClock(p.serviceTime)}`);
  }
  for (const { label, keys } of keysBy.values()) if (new Set(keys.map(x => x.split(' ')[0])).size > 1)
    note(`"${label}" is in different keys (${keys.join(', ')}) — the first one is used.`);

  const cur = await planRows(client, planId);
  const pre = cur.filter(r => r.phase === 'pre-service');          // never touched
  const svc = cur.filter(r => r.phase !== 'pre-service');
  const used = new Set();
  const free = pred => svc.find(r => !used.has(r.id) && pred(r));
  const target = [];   // { row } (existing) or { insert } in ChurchSuite's order, each with .times + .c
  const slotNames = new Set(entries.filter(e => e.item.kind === 'slot' && e.item.slot_title).map(e => norm(e.item.slot_title)));

  for (const { item: c, times: at } of entries) {
    if (c.kind === 'slot') {
      const t = c.slot_title ? norm(c.slot_title) : '';
      // A slot whose title names a song (a carol entered as an empty song slot) is that song: an existing
      // SongStack song of that name is kept; otherwise the library song is used when exactly one matches.
      if (t) {
        const named = { ...c, label: c.slot_title };
        const songs = svc.filter(r => r.type === 'song' && !used.has(r.id));
        const idx = matchSong(c.slot_title, songs, new Set());
        if (idx >= 0) { used.add(songs[idx].id); target.push({ row: songs[idx], c: named, at }); continue; }
        const cand = libraryMatches(c.slot_title, library);
        if (cand.length === 1) { target.push({ insert: { type: 'song', song: cand[0] }, c: named, at }); continue; }
      }
      // Same-named slot first; otherwise any slot that no ChurchSuite slot claims by name.
      const ex = free(r => r.type === 'song_slot' && norm(r.title || '') === t)
        || free(r => r.type === 'song_slot' && !slotNames.has(norm(r.title || '')));
      if (ex) { used.add(ex.id); target.push({ row: ex, c, at }); }
      else target.push({ insert: { type: 'song_slot', title: c.slot_title }, c, at });
      continue;
    }
    const answer = c.ref ? songAnswers.get(c.ref) : null;
    if (answer && answer.decision === 'ignore') continue;              // "not a song — ignore"
    const answered = answer && answer.decision === 'song' ? library.find(sg => sg.id === answer.song_id) : null;
    // An existing SongStack song: the answered song, else a title / first-line match (also for ChurchSuite
    // non-song items that are really songs, e.g. a carol entered as "Misc").
    let ex = answered ? free(r => r.type === 'song' && r.song_id === answered.id) : null;
    if (!ex) {
      const songs = svc.filter(r => r.type === 'song' && !used.has(r.id));
      const idx = matchSong(c.label, songs, new Set());
      if (idx >= 0) ex = songs[idx];
    }
    if (ex) { used.add(ex.id); target.push({ row: ex, c, at }); continue; }
    if (c.kind === 'song') {
      let song = answered;
      let cand = [];
      if (!song) { cand = libraryMatches(c.label, library); if (cand.length === 1) song = cand[0]; }
      if (song) { target.push({ insert: { type: 'song', song }, c, at }); continue; }
      // Not clearly in the library → a "song to be chosen" slot (an existing one of the same name is kept) + a question.
      note(cand.length ? `"${c.label}" matches ${cand.length} library songs (${cand.map(sg => sg.song).join(', ')}) — shown as a song to be chosen.`
                       : `"${c.label}" isn't in the SongStack library (or only matches loosely) — shown as a song to be chosen.`);
      if (c.ref) ask('song', c.ref, date, null, { title: c.label, candidates: cand.map(sg => ({ id: sg.id, title: sg.song })) });
      const slot = free(r => r.type === 'song_slot' && norm(r.title || '') === norm(c.label));
      if (slot) { used.add(slot.id); target.push({ row: slot, c, at }); }
      else target.push({ insert: { type: 'song_slot', title: c.label }, c, at });
      continue;
    }
    const item = free(r => r.type !== 'song' && r.type !== 'song_slot' && norm(r.title || '') && norm(r.title) === norm(c.label));
    if (item) { used.add(item.id); target.push({ row: item, c, at }); }
    else target.push({ insert: { type: 'custom', title: c.label }, c, at });
  }

  // Removed: anything in the plan that ChurchSuite doesn't have (except items an admin chose to keep).
  const keptRows = [];
  for (const r of svc) {
    if (used.has(r.id)) continue;
    if (kept.has(`removed_song|item:${r.id}`)) { keptRows.push(r); continue; }
    await client.query('DELETE FROM plan_items WHERE id = $1', [r.id]);
    await log('remove_item', { item_id: r.id, row: storedRow(r) });
    say(`Removed "${r.song || r.title || (r.type === 'song_slot' ? 'Song to be chosen' : r.type)}" (not in ChurchSuite)`);
  }

  // Added.
  let added = 0;
  for (const t of target.filter(x => x.insert)) {
    const { c, at, insert } = t;
    const st = want(at);
    let row;
    if (insert.type === 'song') {
      const key = c.key && !sameKeyName(c.key, insert.song.default_key) ? c.key : null;
      row = (await client.query(
        `INSERT INTO plan_items (plan_id, type, song_id, position, key_override, duration_minutes, phase, service_times)
         VALUES ($1, 'song', $2, 100000, $3, $4, 'service', $5) RETURNING id`,
        [planId, insert.song.id, key, minutesOf(c) || insert.song.default_duration || null, st])).rows[0];
      await log('add_song', { item_id: row.id, song_id: insert.song.id, title: insert.song.song });
      say(`Added "${insert.song.song}"${norm(insert.song.song) !== norm(c.label) ? ` (ChurchSuite: "${c.label}")` : ''}${st.length ? ` (${st.map(formatClock).join(' & ')} only)` : ''}`);
    } else if (insert.type === 'song_slot') {
      row = (await client.query(
        `INSERT INTO plan_items (plan_id, type, title, position, duration_minutes, phase, service_times)
         VALUES ($1, 'song_slot', $2, 100000, $3, 'service', $4) RETURNING id`, [planId, insert.title, minutesOf(c), st])).rows[0];
      await log('add_item', { item_id: row.id, title: insert.title || 'Song to be chosen' });
      say(`Added a song to be chosen${insert.title ? ` ("${insert.title}")` : ''}${st.length ? ` (${st.map(formatClock).join(' & ')} only)` : ''}`);
    } else {
      row = (await client.query(
        `INSERT INTO plan_items (plan_id, type, title, content, position, duration_minutes, phase, service_times)
         VALUES ($1, 'custom', $2, $3, 100000, $4, 'service', $5) RETURNING id`,
        [planId, insert.title, wordsToHtml(c.words), minutesOf(c), st])).rows[0];
      await log('add_item', { item_id: row.id, title: insert.title });
      say(`Added "${insert.title}"${st.length ? ` (${st.map(formatClock).join(' & ')} only)` : ''}`);
    }
    t.id = row.id; added++;
  }

  // Updates to items that stay: services (ChurchSuite decides), key / length / words (only filling gaps).
  let filled = 0;
  for (const t of target.filter(x => x.row)) {
    const { row: r, c, at } = t;
    t.id = r.id;
    const st = want(at);
    if ((r.st || []).join() !== st.join()) {
      await client.query('UPDATE plan_items SET service_times = $1::time[] WHERE id = $2', [st, r.id]);
      await log('set_services', { item_id: r.id, before: r.st || [], after: st });
      say(`"${r.song || r.title || 'Song to be chosen'}" is now ${st.length ? `only at ${st.map(formatClock).join(' & ')}` : 'at every service'} (as in ChurchSuite)`);
    }
    if (r.type === 'song' && c.key && !r.key_override && !sameKeyName(c.key, r.default_key)) {
      await client.query('UPDATE plan_items SET key_override = $1 WHERE id = $2 AND key_override IS NULL', [c.key, r.id]);
      await log('set_key', { item_id: r.id, key: c.key });
      say(`Key ${c.key} set for "${r.song}" (the plan had none)`);
    }
    const mins = minutesOf(c);
    if (mins && r.duration_minutes == null) {
      await client.query('UPDATE plan_items SET duration_minutes = $1 WHERE id = $2 AND duration_minutes IS NULL', [mins, r.id]);
      await log('set_item', { item_id: r.id, field: 'duration_minutes', after: mins });
      filled++;
    }
    const words = r.type === 'custom' || (r.type !== 'song' && r.type !== 'song_slot') ? wordsToHtml(c.words) : null;
    if (words && !r.content) {
      await client.query('UPDATE plan_items SET content = $1 WHERE id = $2 AND content IS NULL', [words, r.id]);
      await log('set_item', { item_id: r.id, field: 'content', after: words });
      filled++;
    }
  }
  if (filled) say(`Filled in ${filled} length(s) / liturgy text(s) from ChurchSuite (only where SongStack had none)`);

  // Order: pre-service items first (as they are), then ChurchSuite's order. Kept items stay after the item they
  // followed before.
  const order = [...pre.map(r => r.id), ...target.map(t => t.id)];
  for (const r of keptRows) {
    // After the nearest item before it that's still in the plan (pre-service items count); else first in the service.
    let k = -1;
    for (let i = cur.indexOf(r) - 1; i >= 0; i--) { const at = order.indexOf(cur[i].id); if (at >= 0) { k = at; break; } }
    if (k < 0) k = pre.length - 1;
    order.splice(k + 1, 0, r.id);
  }
  const before = Object.fromEntries(cur.map(r => [r.id, r.position]));
  const existingBefore = cur.filter(r => order.includes(r.id)).map(r => r.id).join();
  const existingAfter = order.filter(id => id in before).join();
  if (order.some((id, k) => before[id] !== k)) {
    await client.query(
      `UPDATE plan_items pi SET position = o.pos FROM unnest($2::uuid[], $3::int[]) AS o(id, pos)
        WHERE pi.id = o.id AND pi.plan_id = $1`, [planId, order, order.map((_, k) => k)]);
    // Logged (so undo restores the exact order) when existing items moved, or alongside any other change to this
    // plan. Not on its own when it only closes gaps (someone deleted an item) — that would make "undo last run" undo
    // the gap-closing instead of the run you meant.
    if (existingBefore !== existingAfter || changes > 0) await log('reorder', { before });
    if (existingBefore !== existingAfter) say('Running order changed to match ChurchSuite');
  }
  return { items: target.length, songs: target.filter(t => (t.row ? t.row.type : t.insert.type) === 'song').length,
           slots: target.filter(t => (t.row ? t.row.type : t.insert.type) === 'song_slot').length, added };
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
      WHERE m.church_id = $1 AND m.role IN ('admin', 'member') AND u.name IS NOT NULL`, [churchId])).rows;
  // (Guests are left out on purpose: a ChurchSuite name must never link to a guest's account — guests only get
  // plans an admin gave them. See claude/guest-mode.md.)
  // Answers given once on Settings → ChurchSuite.
  const peopleAnswers = new Map((await pool.query(
    'SELECT cs_key, decision, user_id FROM churchsuite_people WHERE church_id = $1', [churchId])).rows.map(x => [x.cs_key, x]));
  const songAnswers = new Map((await pool.query(
    'SELECT cs_key, decision, song_id FROM churchsuite_songs WHERE church_id = $1', [churchId])).rows.map(x => [x.cs_key, x]));
  // Old "Keep" answers (before the truth model): those items / musicians are never removed.
  const kept = new Set((await pool.query(
    `SELECT kind || '|' || q_key AS k FROM churchsuite_questions
      WHERE church_id = $1 AND status = 'answered' AND answer = 'keep'`, [churchId])).rows.map(x => x.k));
  const ssPlans = (await pool.query(
    `SELECT id, to_char(plan_date, 'YYYY-MM-DD') AS date, to_char(plan_start_time, 'HH24:MI') AS start,
            CASE WHEN plan_start_time IS NULL THEN '{}'::text[]
                 ELSE ARRAY(SELECT to_char(t, 'HH24:MI') FROM unnest(ARRAY[plan_start_time] || extra_times) t ORDER BY t) END AS times
       FROM plans
      WHERE church_id = $1 AND plan_date BETWEEN $2::date AND $3::date`, [churchId, start, to])).rows;

  const csPlans = await cs.plans(start, to);
  for (const p of csPlans) { p.items = await cs.planItems(p.id); p.serviceTime = csServiceTime(p, p.items); }

  const dates = [...new Set(csPlans.map(p => p.date))].sort();
  for (const date of dates) {
    const cps = csPlans.filter(p => p.date === date).sort((a, b) => a.serviceTime.localeCompare(b.serviceTime));
    const sps = ssPlans.filter(p => p.date === date);
    const note = text => notes.push({ date, text });
    const act = text => actions.push({ date, text });
    const times = [...new Set(cps.map(p => p.serviceTime).filter(Boolean))].sort();

    // Which SongStack plan does ChurchSuite control here? (header)
    const controlled = times.length
      ? sps.filter(p => (p.start ? times.includes(p.start) : sps.length === 1))
      : (sps.length === 1 ? sps : []);
    if (controlled.length > 1) { note(`${controlled.length} SongStack plans at ChurchSuite's service times on this date — skipped (not sure which to update).`); continue; }
    if (!times.length && sps.length > 1) { note(`${sps.length} SongStack plans on this date and no service time in ChurchSuite's plan names — skipped.`); continue; }
    const creating = controlled.length === 0;

    let planId = creating ? null : controlled[0].id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const log = (action, detail) => client.query(
        'INSERT INTO churchsuite_sync_log (run_id, church_id, plan_id, action, detail) VALUES ($1,$2,$3,$4,$5)',
        [runId, churchId, planId, action, detail]);
      let created = null;
      if (creating) {
        created = await createPlanRow(client, { churchId, date, cps, times });
        planId = created.planId;
        await log('create_plan', { title: created.title, status: created.status });
      } else {
        const p = (await client.query(
          `SELECT plan_start_time, extra_times, plan_time FROM plans WHERE id = $1 FOR UPDATE`, [planId])).rows[0];
        // Service times = ChurchSuite's.
        if (times.length && controlled[0].times.join() !== times.join()) {
          await client.query(
            `UPDATE plans SET plan_start_time = $2::time, extra_times = $3::time[], plan_time = $4 WHERE id = $1`,
            [planId, times[0], times.slice(1), formatClock(times[0])]);
          await log('set_plan_times', { before: { plan_start_time: p.plan_start_time, extra_times: p.extra_times, plan_time: p.plan_time } });
          act(`Service times changed to ${times.map(formatClock).join(' & ')} (as in ChurchSuite)`);
        }
      }
      await client.query('UPDATE plans SET churchsuite_synced_at = now() WHERE id = $1', [planId]);

      const result = await reconcile(client, { planId, cps, times, library, songAnswers, kept, ask, log, act, note, date, quiet: !!created });
      if (created) {
        act(`Created the plan "${created.title || 'Untitled'}" (${created.status}${times.length ? `, ${times.map(formatClock).join(' & ')}` : ''}): `
          + `${result.items} item(s), ${result.songs} song(s)${result.slots ? `, ${result.slots} song(s) to be chosen` : ''}`);
      }

      // Music team — people on ChurchSuite song items and empty song slots.
      const mus = (await client.query('SELECT * FROM plan_musicians WHERE plan_id = $1', [planId])).rows;
      const team = new Map();   // normalised name → { name, key }
      for (const p of cps) for (const i of p.items) if (i.kind === 'song' || i.kind === 'slot') for (const pr of (i.peopleRefs || i.people.map(n => ({ name: n, key: null })))) {
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
      // Musicians not in ChurchSuite are removed — only once ChurchSuite has a music team for the date (an empty team
      // usually just means the rota isn't done yet). Every row counts (someone on Vocals AND Keys is two rows);
      // likely-same names and old "Keep" answers stay. Guest musicians (added in SongStack with a guest link —
      // guest_token_hash set) are never removed: guests aren't on the ChurchSuite rota. See claude/guest-mode.md.
      const teamUsers = new Set([...team.values()].map(t => t.key && peopleAnswers.get(t.key))
        .filter(x => x && x.decision === 'member').map(x => x.user_id));
      if (team.size) for (const m of mus) {
        if (accounted.has(m.id) || kept.has(`removed_musician|musician:${m.id}`)) continue;
        if (m.guest_token_hash) continue;
        if (team.has(norm(m.name)) || (m.user_id && teamUsers.has(m.user_id))) continue;
        if ([...team.values()].some(t => likelySamePerson(t.name, m.name))) continue;
        await client.query('DELETE FROM plan_musicians WHERE id = $1', [m.id]);
        await log('remove_musician', { musician_id: m.id, row: m });
        act(`Removed ${m.name} (${m.role}) from the music team (not in ChurchSuite)`);
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
