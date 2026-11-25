'use client'

// Add / edit a song arrangement (a version of the song: own key, tempo, time signature, notes, structure, files).
// The song itself is the main arrangement and is edited on the song's Edit page. See claude/song-arrangements.md.
import { useState } from 'react'
import { X } from 'lucide-react'
import api from '@/lib/api'
import { KEYS, normaliseKey } from '@/lib/keys'
import { StructureBuilder } from '@/components/ui/StructureBuilder'
import TempoHint from '@/components/ui/TempoHint'
import { SongArrangement } from '@/types'

const TIME_SIGNATURES = ['4/4', '3/4', '6/8', '9/8', '12/8', '2/4', '2/2', '3/2', '5/4', '7/8']

interface ArrangementModalProps {
  songId: string
  /** Omit to add a new arrangement (name only — key, tempo, time signature and notes are copied from the song). */
  arrangement?: SongArrangement
  onClose: () => void
  onSaved: (arr: SongArrangement) => void
}

export function ArrangementModal({ songId, arrangement, onClose, onSaved }: ArrangementModalProps) {
  const isNew = !arrangement
  const [form, setForm] = useState({
    name: arrangement?.name || '',
    default_key: normaliseKey(arrangement?.default_key) || '',
    time_signature: arrangement?.time_signature || '',
    tempo: arrangement?.tempo?.toString() || '',
    notes: arrangement?.notes || '',
    suggested_structure: arrangement?.suggested_structure || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Give the arrangement a name, e.g. Contemporary.'); return }
    setSaving(true)
    setError(null)
    try {
      const { data } = isNew
        ? await api.post(`/api/songs/${songId}/arrangements`, { name: form.name })
        : await api.put(`/api/songs/${songId}/arrangements/${arrangement!.id}`, form)
      onSaved(data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save the arrangement')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay modal-overlay--front">
      <div onClick={onClose} className="modal-backdrop" />
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">{isNew ? 'Add arrangement' : `Edit arrangement`}</h2>
          <button onClick={onClose} className="modal-close"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-field">
            <label className="label">Arrangement name *</label>
            <input className="input" autoFocus placeholder="e.g. Contemporary" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={80} />
            {isNew && (
              <p className="text-muted text-sm" style={{ marginTop: '0.35rem' }}>
                Starts with the song&apos;s key, tempo, time signature and notes. Add its own files and structure after.
              </p>
            )}
          </div>

          {!isNew && (
            <>
              <div className="form-grid-2 form-field">
                <div>
                  <label className="label">Key</label>
                  <select className="input" value={form.default_key} onChange={e => setForm(f => ({ ...f, default_key: e.target.value }))}>
                    <option value="">Select key…</option>
                    {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div className="form-timing-grid">
                  <div>
                    <label className="label">Time signature</label>
                    <select className="input" value={form.time_signature} onChange={e => setForm(f => ({ ...f, time_signature: e.target.value }))}>
                      <option value="">— select —</option>
                      {TIME_SIGNATURES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Tempo (BPM)</label>
                    <input className="input" type="number" min="20" max="300" placeholder="e.g. 120" value={form.tempo}
                      onChange={e => setForm(f => ({ ...f, tempo: e.target.value }))} />
                  </div>
                </div>
                <TempoHint tempo={form.tempo} timeSignature={form.time_signature} onUse={n => setForm(f => ({ ...f, tempo: String(n) }))} />
              </div>
              <div className="form-field">
                <label className="label">Notes</label>
                <textarea className="input" rows={3} placeholder="Performance notes, tips for the band…" value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <div className="form-field">
                <label className="label">Suggested structure</label>
                <StructureBuilder value={form.suggested_structure}
                  onChange={val => setForm(f => ({ ...f, suggested_structure: val }))} />
              </div>
            </>
          )}

          {error && <p className="input-error">{error}</p>}

          <div className="modal-footer modal-footer--bordered">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isNew ? 'Add arrangement' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
