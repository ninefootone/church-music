// tempoNote.ts — which note a song's tempo counts, so people type the right number (added 2026-11-25).
// SongStack's tempo is the beat you count: a dotted crotchet in 6/8, 9/8, 12/8 (compound time), a minim in 2/2 and
// 3/2, a crotchet in x/4. Printed music sometimes gives a different note (e.g. "♪ = 110" in a slow 6/8 = 37 here).
// The iPad app has the same rules (songstack-spike metronome.ts: meter, tempoNote).

const parse = (sig: string | null | undefined) => {
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(sig ?? '')
  return m ? { num: parseInt(m[1], 10), den: parseInt(m[2], 10) } : null
}

// 6/8, 9/8, 12/8: the beat is a dotted crotchet (quavers in threes).
export function isCompound(sig: string | null | undefined): boolean {
  const p = parse(sig)
  return !!p && p.den === 8 && p.num > 3 && p.num % 3 === 0
}

// The note the tempo counts, for labels: 'Dotted ♩', 'Minim', '♪' (7/8) or '♩'.
export function tempoNote(sig: string | null | undefined): string {
  const p = parse(sig)
  if (!p) return '♩'
  if (isCompound(sig)) return 'Dotted ♩'
  if (p.den === 2) return 'Minim'
  if (p.den === 8) return '♪'
  return '♩'
}

// A compound-time tempo this high was probably typed as a quaver tempo (♪ = 110 rather than dotted ♩ = 37).
export const SUSPECT_COMPOUND_TEMPO = 100
export const looksLikeQuaverTempo = (tempo: number | null | undefined, sig: string | null | undefined) =>
  !!tempo && tempo >= SUSPECT_COMPOUND_TEMPO && isCompound(sig)
