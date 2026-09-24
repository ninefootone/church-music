/**
 * Arrangements are stored as a JSON array string, e.g. '["Verse 1","Chorus","Ending"]'.
 * Older/imported rows may be plain text. Returns the parts for a JSON array,
 * or null for plain-text (legacy) values so callers can show the raw text.
 */
export function parseArrangement(raw: string | null | undefined): string[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
  } catch {}
  return null
}