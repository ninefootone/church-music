'use client'

import { useState } from 'react'
import { Download, Edit, Trash2 } from 'lucide-react'
import { KeyBadge } from '@/components/ui/badges'
import api from '@/lib/api'

const FILE_TYPES = [
  { value: 'chords',     label: 'Chord chart' },
  { value: 'lead',       label: 'Lead sheet' },
  { value: 'vocal',      label: 'Vocal sheet' },
  { value: 'full_score', label: 'Full score' },
]

const KEYS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

interface FileRowProps {
  file: any
  songId: string
  defaultKey?: string | null
  isAdmin: boolean
  downloadingId: string | null
  deletingId: string | null
  onDownload: (fileId: string, label: string) => void
  onDelete: (fileId: string) => void
  onSaved: () => void
}

export function FileRow({ file, songId, defaultKey, isAdmin, downloadingId, deletingId, onDownload, onDelete, onSaved }: FileRowProps) {
  const [editing, setEditing] = useState(false)
  const [editType, setEditType] = useState(file.file_type || 'chords')
  const [editLabel, setEditLabel] = useState(file.label || '')
  const [editKey, setEditKey] = useState(file.key_of || defaultKey || '')
  const [saving, setSaving] = useState(false)

  const openEdit = () => {
    setEditType(file.file_type || 'chords')
    setEditLabel(file.label || '')
    setEditKey(file.key_of || '')
    setEditing(true)
  }

  const handleTypeChange = (val: string) => {
    setEditType(val)
    const match = FILE_TYPES.find(t => t.value === val)
    if (match) setEditLabel(match.label)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch(`/api/uploads/songs/${songId}/files/${file.id}`, {
        file_type: editType,
        label: editLabel,
        key_of: editKey || null,
      })
      onSaved()
      setEditing(false)
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-sm)', background: 'var(--color-neutral-50)', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <div>
            <label className="label" style={{ fontSize: 'var(--text-xs)' }}>Type</label>
            <select className="input" style={{ fontSize: 'var(--text-sm)', padding: '4px 8px' }} value={editType} onChange={e => handleTypeChange(e.target.value)}>
              {FILE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" style={{ fontSize: 'var(--text-xs)' }}>Label</label>
            <input className="input" style={{ fontSize: 'var(--text-sm)', padding: '4px 8px' }} value={editLabel} onChange={e => setEditLabel(e.target.value)} />
          </div>
          <div>
            <label className="label" style={{ fontSize: 'var(--text-xs)' }}>Key</label>
            <select className="input" style={{ fontSize: 'var(--text-sm)', padding: '4px 8px' }} value={editKey} onChange={e => setEditKey(e.target.value)}>
              <option value="">No key</option>
              {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => setEditing(false)} className="btn btn-secondary btn-sm" style={{ fontSize: 'var(--text-xs)' }}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm" style={{ fontSize: 'var(--text-xs)' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        onClick={() => onDownload(file.id, file.label)}
        disabled={downloadingId === file.id}
        className="download-btn"
      >
        <Download size={14} />
        {downloadingId === file.id ? 'Downloading…' : file.label}
        {file.key_of && file.key_of !== defaultKey && <KeyBadge keyOf={file.key_of} />}
      </button>
      {isAdmin && (
        <>
          <button
            onClick={openEdit}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'flex' }}
            title="Edit file details"
          >
            <Edit size={14} />
          </button>
          <button
            onClick={() => onDelete(file.id)}
            disabled={deletingId === file.id}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'flex', opacity: deletingId === file.id ? 0.5 : 1 }}
            title="Delete file"
          >
            <Trash2 size={14} />
          </button>
        </>
      )}
    </div>
  )
}
