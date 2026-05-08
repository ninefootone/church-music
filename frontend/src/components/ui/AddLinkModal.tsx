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
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-md)' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      <div style={{ position: 'relative', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
            Add links
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {entries.map(entry => (
              <div
                key={entry.id}
                style={{
                  border: `1px solid ${entry.status === 'error' ? 'var(--color-danger)' : entry.status === 'done' ? 'var(--color-success)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  background: entry.status === 'done' ? 'var(--color-success-bg, #f0fdf4)' : 'var(--color-surface)',
                  opacity: entry.status === 'done' ? 0.7 : 1,
                }}
              >
                {entry.status === 'done' ? (
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>✓ Saved</span>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr auto', gap: 8, alignItems: 'center' }}>
                    <select
                      className="input"
                      style={{ fontSize: 'var(--text-sm)', padding: '4px 8px' }}
                      value={entry.link_type}
                      onChange={e => updateEntry(entry.id, { link_type: e.target.value })}
                      disabled={entry.status === 'saving'}
                    >
                      {LINK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input
                        className="input"
                        style={{ fontSize: 'var(--text-sm)', padding: '4px 8px' }}
                        placeholder="URL"
                        value={entry.url}
                        onChange={e => updateEntry(entry.id, { url: e.target.value })}
                        disabled={entry.status === 'saving'}
                      />
                      <input
                        className="input"
                        style={{ fontSize: 'var(--text-sm)', padding: '4px 8px' }}
                        placeholder="Label (optional, e.g. Live version)"
                        value={entry.label}
                        onChange={e => updateEntry(entry.id, { label: e.target.value })}
                        disabled={entry.status === 'saving'}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2, display: 'flex', alignSelf: 'flex-start', marginTop: 4 }}
                      disabled={entry.status === 'saving'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
                {entry.error && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', marginTop: 6 }}>{entry.error}</p>
                )}
              </div>
            ))}
          </div>

          <button type="button" onClick={addEntry} className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
            <Plus size={13} /> Add another link
          </button>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--color-border)' }}>
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