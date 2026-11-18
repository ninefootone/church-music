// Shared ChurchSuite API v2 (Planning) helpers for the trial scripts. READ-ONLY.
// Will become the basis of the real sync service if the integration is built.
const API = 'https://api.churchsuite.com/v2';
const TOKEN_URL = 'https://login.churchsuite.com/oauth2/token';

function createClient(clientId, clientSecret) {
  let token = null;

  async function getToken() {
    const body = new URLSearchParams({ grant_type: 'client_credentials', scope: 'planning.read' });
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
      body,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`ChurchSuite token request failed (${res.status}): ${text}`);
    token = JSON.parse(text).access_token;
  }

  async function get(pathAndQuery) {
    if (!token) await getToken();
    const res = await fetch(`${API}${pathAndQuery}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (res.status === 429) {
      const wait = parseInt(res.headers.get('retry-after') || '5', 10);
      await new Promise(r => setTimeout(r, wait * 1000));
      return get(pathAndQuery);
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`GET ${pathAndQuery} → ${res.status}: ${text}`);
    return JSON.parse(text);
  }

  async function listAll(pathAndQuery) {
    const out = [];
    for (let page = 1; page < 50; page++) {
      const sep = pathAndQuery.includes('?') ? '&' : '?';
      const json = await get(`${pathAndQuery}${sep}page=${page}&per_page=100`);
      out.push(...json.data);
      const p = json.pagination || {};
      const more = p.next_page ?? (p.num_pages ? page < p.num_pages : json.data.length === 100);
      if (!more) break;
    }
    return out;
  }

  const cache = { types: null, library: new Map(), arrangements: new Map(), songs: new Map() };

  async function types() {
    if (!cache.types) cache.types = new Map((await listAll('/planning/types')).map(t => [t.id, t]));
    return cache.types;
  }

  // Plans between two YYYY-MM-DD dates, published AND drafts (the API defaults to published only).
  async function plans(from, to) {
    const q = `starts_after=${from}&starts_before=${to}&order_by=date:asc`;
    // Tagged with the list they came from, so `status` is always set ('published' / 'draft').
    const all = [
      ...(await listAll(`/planning/plans?${q}&status=published`)).map(p => ({ ...p, status: 'published' })),
      ...(await listAll(`/planning/plans?${q}&status=draft`)).map(p => ({ ...p, status: 'draft' })),
    ];
    return all.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }

  const answer = (responses, name) =>
    (responses || []).find(r => (r.name || '').toLowerCase() === name.toLowerCase())?.value || '';

  // A plan's items, simplified: { id, kind: 'song'|'item', label, key, author, people[], peopleRefs[], ref, time_start, type_name }
  //   peopleRefs: [{ name, key }] — key = '<type>:<ChurchSuite id>' (stable when names change).
  //   ref: which ChurchSuite song it is — 'song:<Songs-module id>' / 'lib:<library item id>' (null otherwise).
  async function planItems(planId) {
    const t = await types();
    const raw = await listAll(`/planning/plan_items?plan_ids[]=${planId}&order_by=order:asc`);
    const out = [];
    for (const it of raw) {
      const type = t.get(it.type_id);
      const typeName = type?.name || '';
      const peopleRefs = (it.people || [])
        .map(p => ({ name: `${p.first_name || ''} ${p.last_name || ''}`.trim(), key: p.id ? `${p.type || p.resource_type || 'person'}:${p.id}` : null }))
        .filter(p => p.name);
      const people = peopleRefs.map(p => p.name);
      let kind = 'item', label = it.name || typeName || 'Untitled', key = '', author = '', ref = null;
      if (it.type === 'song' || it.arrangement_id) {
        kind = 'song';
        if (!cache.arrangements.has(it.arrangement_id)) cache.arrangements.set(it.arrangement_id, (await get(`/planning/song_arrangements/${it.arrangement_id}`)).data);
        const arr = cache.arrangements.get(it.arrangement_id);
        if (!cache.songs.has(arr.song_id)) cache.songs.set(arr.song_id, (await get(`/planning/songs/${arr.song_id}`)).data);
        const song = cache.songs.get(arr.song_id);
        label = song.name; key = it.settings?.key || answer(it.question_responses, 'Key') || arr.key || ''; author = arr.artist || '';
        ref = `song:${arr.song_id}`;
      } else if (it.library_item_id && (type?.ccli_tracking || /song|hymn/i.test(typeName))) {
        kind = 'song';
        key = answer(it.question_responses, 'Key');
        author = answer(it.question_responses, 'Artist/Author');
      }
      if (!ref && it.library_item_id) ref = `lib:${it.library_item_id}`;
      out.push({ id: it.id, kind, label, key, author, people, peopleRefs, ref, words: answer(it.question_responses, 'Words'),
        time_start: it.time_start || '', type_name: typeName });
    }
    return out;
  }

  return { plans, planItems, types };
}

// Normalise a title/name for matching: case, accents, apostrophes, punctuation.
const norm = s => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/['‘’`´]/g, '')
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

// "Title (Other Title)" → normalised [full, before bracket, inside bracket]
const titleVariants = t => {
  const out = [norm(t)];
  const m = (t || '').match(/^(.*?)\s*\((.+)\)\s*$/);
  if (m) out.push(norm(m[1]), norm(m[2]));
  return [...new Set(out.filter(Boolean))];
};

module.exports = { createClient, norm, titleVariants };
