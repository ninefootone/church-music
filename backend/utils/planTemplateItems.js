// Shared helpers for plan templates. Template items live in a JSONB column, so
// the database can't enforce their shape — everything is normalised here on
// the way in (and again when copied into a real plan).
//
// v1 rule: templates never hold specific songs. Any 'song' item becomes an
// empty 'song_slot', which the plan builder fills as songs are added.

const { sanitizeRichText } = require('./sanitize');

const MAX_ITEMS = 200;

function cleanText(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function cleanDuration(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 && n <= 600 ? n : null;
}

function normaliseTemplateItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === 'object')
    .slice(0, MAX_ITEMS)
    .map((item) => {
    const rawType = typeof item?.type === 'string' ? item.type.trim().slice(0, 40) : '';
    const phase = item?.phase === 'pre-service' ? 'pre-service' : 'service';
    const duration_minutes = cleanDuration(item?.duration_minutes);

    if (rawType === 'song' || rawType === 'song_slot') {
      // A slot may carry a label ("Response song") but never song-specific notes.
      return {
        type: 'song_slot',
        title: rawType === 'song_slot' ? cleanText(item.title, 200) : null,
        notes: null,
        content: null,
        duration_minutes,
        phase,
      };
    }

    return {
      type: rawType || 'custom',
      title: cleanText(item?.title, 500),
      notes: cleanText(item?.notes, 5000),
      content: sanitizeRichText(item?.content),
      duration_minutes,
      phase,
    };
  });
}

// Inserts normalised template items into plan_items for planId, using the
// caller's client so it runs inside their transaction.
async function insertTemplateItems(client, planId, items) {
  const clean = normaliseTemplateItems(items);
  for (let i = 0; i < clean.length; i++) {
    const it = clean[i];
    await client.query(
      'INSERT INTO plan_items (plan_id, type, song_id, title, notes, content, key_override, position, custom_arrangement, duration_minutes, phase) VALUES ($1,$2,NULL,$3,$4,$5,NULL,$6,NULL,$7,$8)',
      [planId, it.type, it.title, it.notes, it.content, i, it.duration_minutes, it.phase]
    );
  }
}

module.exports = { normaliseTemplateItems, insertTemplateItems, cleanText };
