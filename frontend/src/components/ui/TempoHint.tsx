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
          <button type="button" className="btn-text tempo-hint-use" onClick={() => onUse(fixed)}>Use {fixed}</button>
        </div>
      )
    }
    return <div className="tempo-hint">Dotted ♩ per minute. If the music says ♪ = 110, enter 37.</div>
  }
  const note = tempoNote(timeSignature)
  if (note === '♩') return null   // x/4 or no time signature: "BPM" is clear enough
  return <div className="tempo-hint">{note} per minute.</div>
}
