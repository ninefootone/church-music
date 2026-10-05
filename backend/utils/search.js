// Turns what the user typed into a prefix-match full-text query:
//   "Joyful N"  ->  "joyful:* & n:*"
// Every word must appear (AND), and each one matches the START of a word, so
// "joy" finds joy / joyful / joys, but "joyful" does NOT find plain "joy".
// Used with to_tsquery('simple', …) against vectors built with the 'simple'
// config (no stemming) — see db/switch-search-to-simple.js.
// Only letters and digits survive, so the result is always valid tsquery syntax
// (no user input can inject & | ! : operators). Empty input gives '' which
// matches nothing — the title ILIKE fallback still applies.
function toPrefixQuery(text) {
  const words = String(text || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  return words.map(w => `${w}:*`).join(' & ');
}

module.exports = { toPrefixQuery };
