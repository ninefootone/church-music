// Store musical keys in one spelling: 'B♭' → 'Bb', 'F♯' → 'F#', spaces removed.
// Library imports and master-library copies brought in ♭/♯ symbols, which never
// matched the dropdown values ('Bb'), so files in the song's own key showed under
// "Other keys". Mirrors normaliseKey in frontend/src/lib/keys.ts.
function normaliseKey(k) {
  if (k === null || k === undefined) return k;
  const s = String(k).replace(/♯/g, '#').replace(/♭/g, 'b').replace(/\s+/g, '');
  return s === '' ? null : s;
}

module.exports = { normaliseKey };
