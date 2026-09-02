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

module.exports = { sanitizeRichText };