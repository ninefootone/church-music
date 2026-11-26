'use client'

// TempoHint — the line under a song / arrangement tempo box (added 2026-11-25). SongStack's tempo is the beat you
// count, so in 6/8, 9/8, 12/8 it's a dotted ♩ — printed music sometimes gives ♪ = 110, which here is 37 (Jon typed
// 110 and the iPad click ran three times too fast). Shows which note the number counts, and offers the ÷3 when a
// compound-time tempo looks like a ♪ tempo. Rules: lib/tempoNote.ts. Used on new song, edit song, ArrangementModal.

import { isCompound, tempoNote, looksLikeQuaverTempo } from '@/lib/tempoNote'

export default function TempoHint({ tempo, timeSignature, onUse }: {
  tempo: string
  timeSignature: string
  onUse: (n: number) => void
}) {
  const n = Number(tempo)
  if (isCompound(timeSignature)) {
    if (Number.isInteger(n) && looksLikeQuaverTempo(n, timeSignature)) {
      const fixed = Math.round(n / 3)
      return (
        <div className="tempo-hint tempo-hint--warn">
          Very fast for a dotted ♩ in {timeSignature}. If the music says ♪ = {n}, the tempo is {fixed}.{' '}
          <button type="button" className="btn-text tempo-hint-use" onClick={() => onUse(fixed)}>Use {fixed} (= ♪ {fixed * 3})</button>
        </div>
      )
    }
    // Show the ♪ equivalent the iPad shows ("Same as ♪ = 111"), so admins and leaders see the same pair of numbers.
    const eq = Number.isInteger(n) && n > 0 ? ` (= ♪ ${n * 3})` : ''
    return <div className="tempo-hint">Dotted ♩ per minute{eq}. If the music says ♪ = 110, enter 37.</div>
  }
  // Always say which note the tempo counts, even in 4/4 (consistent with 6/8 — Jon, 2026-11-26).
  return <div className="tempo-hint">{tempoNote(timeSignature)} per minute.</div>
}
