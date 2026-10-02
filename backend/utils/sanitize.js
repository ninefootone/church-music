// Server-side sanitiser for user rich-text (liturgy content, snippets).
// This is the security boundary that protects the PUBLIC share link: the
// frontend editor is convenience, but content can be POSTed to the API
// directly, so we clamp to a tiny allowlist on save. Nothing outside
// <p>/<br>/<strong>/<em> — and no attributes at all — reaches the database.

const sanitizeHtml = require('sanitize-html');

const RICH_TEXT_OPTS = {
  allowedTags: ['p', 'br', 'strong', 'em'],
  allowedAttributes: {},
  // 'discard' (the default) strips disallowed tags but keeps their text —
  // a stray tag loses its markup, not the words inside it.
  disallowedTagsMode: 'discard',
};

// Matches "visually empty" content the editor produces for a blank box, e.g.
// <p></p> or <p><br></p>, so we store NULL instead of meaningless markup.
const EMPTY_RE = /^(?:<p>(?:\s|<br\s*\/?>)*<\/p>|\s)*$/i;

function sanitizeRichText(input) {
  if (input == null) return null;
  const clean = sanitizeHtml(String(input), RICH_TEXT_OPTS).trim();
  if (!clean || EMPTY_RE.test(clean)) return null;
  return clean;
}

// Web links people type in (playlists, song links, copyright link). Only http(s)
// is allowed: React 18 still renders `javascript:` hrefs, which run script on
// click. A bare domain ("open.spotify.com/…") gets https:// added.
// Returns: null for empty, the cleaned string if OK, or undefined if NOT a web link.
function cleanHttpUrl(input) {
  if (input === null || input === undefined) return null;
  let s = String(input).trim();
  if (!s) return null;
  if (s.length > 2000) return undefined;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { return undefined; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
  if (!u.hostname || !u.hostname.includes('.')) return undefined;
  return s;
}

const BAD_URL_MESSAGE = 'Links must be web addresses starting http:// or https://';

module.exports = { sanitizeRichText, cleanHttpUrl, BAD_URL_MESSAGE };