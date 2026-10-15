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

// ── Lint ────────────────────────────────────────────────────────────────────
// ChordSheetJS is lenient: "[GAmazing [C]grace" (a deleted "]") parses as one chord
// called "GAmazing [C", a stray "]" becomes lyrics, and a misspelt directive like
// {start_of_chrous} is silently dropped. These checks catch what the parser lets
// through. Severity 'error' = the band would see something broken (blocks Save);
// 'warning' = unusual but may be intended (shown, never blocks — a valid but odd
// file, e.g. a SongSelect export, must not become unsaveable).

export interface ChordProWarning { line: number; message: string; severity: 'error' | 'warning' }

const KNOWN_DIRECTIVES = new Set([
  'title', 't', 'subtitle', 'st', 'artist', 'composer', 'lyricist', 'arranger', 'copyright', 'album', 'year',
  'key', 'time', 'tempo', 'duration', 'capo', 'meta', 'sorttitle',
  'comment', 'c', 'comment_italic', 'ci', 'comment_box', 'cb', 'highlight',
  'chorus', 'new_page', 'np', 'new_physical_page', 'npp', 'column_break', 'colb', 'columns', 'col',
  'pagetype', 'titles', 'define', 'chord', 'transpose', 'image',
  'textfont', 'textsize', 'textcolour', 'textcolor', 'chordfont', 'chordsize', 'chordcolour', 'chordcolor',
  'tabfont', 'tabsize', 'tabcolour', 'tabcolor',
  'soc', 'eoc', 'sov', 'eov', 'sob', 'eob', 'sot', 'eot', 'sog', 'eog',
  // SongSelect exports add these
  'ccli', 'ccli_license', 'ccli_song_number', 'footer', 'publisher', 'admin',
])
// Typo targets for directives that change what's shown (unknown directives are otherwise
// ignored harmlessly, so they get no message).
const IMPORTANT_DIRECTIVES = ['title', 'subtitle', 'artist', 'comment', 'comment_italic', 'comment_box', 'chorus', 'capo', 'key', 'tempo']
const SECTION_ABBR: Record<string, string> = { c: 'chorus', v: 'verse', b: 'bridge', t: 'tab', g: 'grid' }
// tab/grid left out: too short — "tag" (a common worship section) is one letter from "tab".
const STANDARD_SECTIONS = ['chorus', 'verse', 'bridge']
const SKIP_SECTIONS = ['tab', 'grid']

// Custom sections ({start_of_intro}) are valid ChordPro, so only flag names that are a
// likely typo of a standard one ({start_of_chrous}).
// Up to 1 edit for short words, 2 for 6+ letters ("chrous" → chorus, but "ccli" ≠ "colb").
function nearMiss(name: string, targets: string[], skip: string[] = []): string | null {
  if (targets.includes(name) || skip.includes(name)) return null
  for (const target of targets) {
    const d: number[][] = Array.from({ length: name.length + 1 }, (_, i) => [i])
    for (let j = 1; j <= target.length; j++) d[0][j] = j
    for (let i = 1; i <= name.length; i++)
      for (let j = 1; j <= target.length; j++)
      {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (name[i - 1] === target[j - 1] ? 0 : 1))
        // swapped neighbours ("titel") count as one edit
        if (i > 1 && j > 1 && name[i - 1] === target[j - 2] && name[i - 2] === target[j - 1])
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    if (d[name.length][target.length] <= (target.length >= 6 ? 2 : 1)) return target
  }
  return null
}

// Root A–G (any case so "[am]" isn't flagged), no spaces or brackets. Annotations ([*Riff]),
// N.C. and simple rhythm marks are allowed.
const CHORD_RE = /^\(?[A-Ga-g][#b♯♭]?[^\s[\]]*\)?$/
const isChordOk = (c: string) =>
  c.startsWith('*') || /^(N\.?C\.?|x|%|\||\/|-)$/i.test(c) || CHORD_RE.test(c)

export function lintChordPro(text: string): ChordProWarning[] {
  const warnings: ChordProWarning[] = []
  let openSection: { name: string; line: number } | null = null
  const lines = text.split(/\r?\n/)

  lines.forEach((raw, i) => {
    const line = i + 1
    const t = raw.trim()
    if (!t || t.startsWith('#')) return

    if (t.startsWith('{')) {
      const m = t.match(/^\{\s*([A-Za-z_][\w-]*)/)
      if (!m) return // missing name / missing } — the parser reports those
      const name = m[1].toLowerCase()
      let section: string | null = null
      let isStart = false
      const long = name.match(/^(start|end)_of_(\w+)$/)
      const short = name.match(/^(s|e)o([cvbtg])$/)
      if (long) { isStart = long[1] === 'start'; section = long[2] }
      else if (short) { isStart = short[1] === 's'; section = SECTION_ABBR[short[2]] }
      else if (!KNOWN_DIRECTIVES.has(name) && !name.startsWith('x_')) {
        const guess = nearMiss(name, IMPORTANT_DIRECTIVES)
        if (guess) warnings.push({ line, severity: 'warning', message: `{${m[1]}} — did you mean {${guess}}? As written it's ignored.` })
      }
      if (section && isStart) {
        const guess = nearMiss(section, STANDARD_SECTIONS, SKIP_SECTIONS)
        if (guess) warnings.push({ line, severity: 'warning', message: `{start_of_${section}} — did you mean {start_of_${guess}}?` })
      }
      if (section) {
        if (isStart) {
          if (openSection) warnings.push({ line, severity: 'warning', message: `{start_of_${section}} starts before {start_of_${openSection.name}} (line ${openSection.line}) is ended.` })
          openSection = { name: section, line }
        } else if (!openSection) {
          warnings.push({ line, severity: 'warning', message: `{end_of_${section}} has no matching start.` })
        } else {
          if (openSection.name !== section) warnings.push({ line, severity: 'warning', message: `{end_of_${section}} ends a ${openSection.name} started on line ${openSection.line}.` })
          openSection = null
        }
      }
      return
    }

    // Tab and grid blocks are free-form — don't check brackets in them.
    if (openSection && (openSection.name === 'tab' || openSection.name === 'grid')) return

    let open = -1
    for (let p = 0; p < raw.length; p++) {
      const ch = raw[p]
      if (ch === '[') {
        if (open !== -1) { warnings.push({ line, severity: 'error', message: `A chord opened with [ isn't closed with ] before the next [.` }); return }
        open = p
      } else if (ch === ']') {
        if (open === -1) { warnings.push({ line, severity: 'error', message: `Stray ] with no [ before it.` }); return }
        const chord = raw.slice(open + 1, p).trim()
        if (!chord) warnings.push({ line, severity: 'warning', message: `Empty chord [].` })
        else if (!isChordOk(chord)) warnings.push({ line, severity: 'warning', message: `[${chord}] doesn't look like a chord.` })
        open = -1
      }
    }
    // An unclosed [ at the end of the line is a parser error — reported there.
  })

  // (cast: TS can't see the forEach callback reassigning openSection)
  const unclosed = openSection as { name: string; line: number } | null
  if (unclosed) warnings.push({ line: unclosed.line, severity: 'warning', message: `{start_of_${unclosed.name}} is never ended.` })
  return warnings
}
