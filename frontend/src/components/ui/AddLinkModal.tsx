'use client'

import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import api from '@/lib/api'

const LINK_TYPES = [
  { value: 'youtube',     label: 'YouTube' },
  { value: 'spotify',     label: 'Spotify' },
  { value: 'apple_music', label: 'Apple Music' },
  { value: 'other',       label: 'Other' },
]

interface LinkEntry {
  id: string
  url: string
  label: string
  link_type: string
  status: 'pending' | 'saving' | 'done' | 'error'
  error?: string
}

interface AddLinkModalProps {
  songId: string
  onClose: () => void
  onSaved: () => void
}

export function AddLinkModal({ songId, onClose, onSaved }: AddLinkModalProps) {
  const [entries, setEntries] = useState<LinkEntry[]>([
    { id: Math.random().toString(36).slice(2), url: '', label: '', link_type: 'youtube', status: 'pending' }
  ])
  const [saving, setSaving] = useState(false)

  const addEntry = () => setEntries(prev => [
    ...prev,
    { id: Math.random().toString(36).slice(2), url: '', label: '', link_type: 'youtube', status: 'pending' }
  ])

  const updateEntry = (id: string, patch: Partial<LinkEntry>) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))

  const removeEntry = (id: string) =>
    setEntries(prev => prev.filter(e => e.id !== id))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const toSave = entries.filter(e => e.url.trim())
    if (!toSave.length) return

    setSaving(true)
    let anySaved = false

    for (const entry of toSave) {
      updateEntry(entry.id, { status: 'saving', error: undefined })
      try {
        await api.post(`/api/songs/${songId}/videos`, {
          url: entry.url,
          label: entry.label || null,
          link_type: entry.link_type,
          sort_order: 0,
        })
        updateEntry(entry.id, { status: 'done' })
        anySaved = true
      } catch (err: any) {
        updateEntry(entry.id, { status: 'error', error: err.response?.data?.error || 'Failed to save' })
      }
    }

    setSaving(false)
    if (anySaved) onSaved()

    const hasErrors = entries.some(e => e.status === 'error')
    if (!hasErrors) onClose()
  }

  const pendingCount = entries.filter(e => e.url.trim() && (e.status === 'pending' || e.status === 'error')).length

  return (
    <div className="modal-overlay modal-overlay--front">
      <div onClick={onClose} className="modal-backdrop" />
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">
            Add links
          </h2>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-stack form-stack--sm">
            {entries.map(entry => (
              <div
                key={entry.id}
                className="link-entry-card"
                style={{
                  border: `1px solid ${entry.status === 'error' ? 'var(--color-danger)' : entry.status === 'done' ? 'var(--color-success)' : 'var(--color-border)'}`,
                  background: entry.status === 'done' ? 'var(--color-success-bg, #f0fdf4)' : 'var(--color-surface)',
                  opacity: entry.status === 'done' ? 0.7 : 1,
                }}
              >
                {entry.status === 'done' ? (
                  <span className="input-success-msg">✓ Saved</span>
                ) : (
                  <div className="modal-field">
                    <div className="link-entry-row">
                      <select
                        className="input link-type-select"
                        value={entry.link_type}
                        onChange={e => updateEntry(entry.id, { link_type: e.target.value })}
                        disabled={entry.status === 'saving'}
                      >
                        {LINK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeEntry(entry.id)}
                        className="btn-icon-remove ml-auto"
                        disabled={entry.status === 'saving'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <input
                      className="input input--sm"
                      placeholder="URL"
                      value={entry.url}
                      onChange={e => updateEntry(entry.id, { url: e.target.value })}
                      disabled={entry.status === 'saving'}
                    />
                    <input
                      className="input input--sm"
                      placeholder="Label (optional, e.g. Live version)"
                      value={entry.label}
                      onChange={e => updateEntry(entry.id, { label: e.target.value })}
                      disabled={entry.status === 'saving'}
                    />
                  </div>
                )}
                {entry.error && (
                  <p className="input-error">{entry.error}</p>
                )}
              </div>
            ))}
          </div>

          <button type="button" onClick={addEntry} className="btn btn-secondary btn-sm btn-self-start">
            <Plus size={13} /> Add another link
          </button>

          <div className="modal-footer modal-footer--bordered">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || pendingCount === 0}
            >
              {saving ? 'Saving…' : pendingCount === 1 ? 'Save 1 link' : `Save ${pendingCount} links`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
