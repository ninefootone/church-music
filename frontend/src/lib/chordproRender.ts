import DOMPurify from 'dompurify'

// One ChordPro → HTML pipeline for the web app. Used by the ChordPro viewer and the
// split-view editor preview so the preview shows what the viewer will show.
// (SetViewer / PublicSetViewer still have their own copies — move them here when next touched.)

export type ChordProRenderResult =
  | { ok: true; html: string }
  | { ok: false; message: string; line: number | null }

let chordSheetPromise: Promise<typeof import('chordsheetjs')> | null = null
function loadChordSheet() {
  if (!chordSheetPromise) chordSheetPromise = import('chordsheetjs')
  return chordSheetPromise
}

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const normalizeKey = (k: string) =>
  k.replace('Db', 'C#').replace('Eb', 'D#').replace('Gb', 'F#').replace('Ab', 'G#').replace('Bb', 'A#')

/** Semitones up from `from` to `to` (0–11), or 0 if either key isn't recognised. */
export function semitonesBetween(from: string, to: string): number {
  const a = CHROMATIC.indexOf(normalizeKey(from))
  const b = CHROMATIC.indexOf(normalizeKey(to))
  if (a === -1 || b === -1) return 0
  return (b - a + 12) % 12
}

/**
 * Parse and render ChordPro text. Never throws: a syntax error comes back as
 * { ok: false, line } so callers can show it (the parser fails on half-typed
 * input like "[G" or "{title: Te", which happens constantly while editing).
 */
export async function renderChordPro(text: string, transposeSemitones = 0): Promise<ChordProRenderResult> {
  const { default: ChordSheetJS } = await loadChordSheet()
  let song
  try {
    song = new ChordSheetJS.ChordProParser().parse(text)
  } catch (err) {
    const e = err as { message?: string; location?: { start?: { line?: number } } }
    return { ok: false, message: e.message || 'Could not read this ChordPro', line: e.location?.start?.line ?? null }
  }

  try {
    if (transposeSemitones) song = song.transpose(transposeSemitones)
  } catch (err) {
    console.warn('ChordPro transpose failed, showing original key', err)
  }

  const rawHtml = new ChordSheetJS.HtmlDivFormatter().format(song)

  // HtmlDivFormatter puts the title/subtitle in bare <h1>/<h2>; wrap them in the
  // styled title block (same treatment as the set viewer).
  const titleMatch = rawHtml.match(/<h1 class="title">(.*?)<\/h1>/)
  const subtitleMatch = rawHtml.match(/<h2 class="subtitle">(.*?)<\/h2>/)
  let titleBlock = ''
  if (titleMatch || subtitleMatch) {
    titleBlock = '<div class="paragraph chordpro-title-block">'
    if (titleMatch) titleBlock += `<div class="chordpro-song-title">${titleMatch[1]}</div>`
    if (subtitleMatch) titleBlock += `<div class="chordpro-song-subtitle">${subtitleMatch[1]}</div>`
    titleBlock += '</div>'
  }
  const body = rawHtml
    .replace(/<h1 class="title">.*?<\/h1>\s*/g, '')
    .replace(/<h2 class="subtitle">.*?<\/h2>\s*/g, '')

  return { ok: true, html: DOMPurify.sanitize(titleBlock + body) }
}
