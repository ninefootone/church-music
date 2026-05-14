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
  { value: 'chordpro',   label: 'ChordPro' },
  { value: 'other',      label: 'Other' },
]

const KEYS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'Abm', 'Am', 'Bbm', 'Bm']

const normaliseKey = (k: string | null | undefined) => k ? k.replace(/♯/g, '#').replace(/♭/g, 'b') : ''

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
  onView?: (fileId: string, label: string, key: string | null) => void
}

export function FileRow({ file, songId, defaultKey, isAdmin, downloadingId, deletingId, onDownload, onDelete, onSaved, onView }: FileRowProps) {
  const [editing, setEditing] = useState(false)
  const [editType, setEditType] = useState(file.file_type || 'chords')
  const [editLabel, setEditLabel] = useState(file.label || '')
  const [editKey, setEditKey] = useState(normaliseKey(file.key_of) || normaliseKey(defaultKey) || '')
  const [saving, setSaving] = useState(false)

  const openEdit = () => {
    setEditType(file.file_type || 'chords')
    setEditLabel(file.label || '')
    setEditKey(normaliseKey(file.key_of) || normaliseKey(defaultKey) || '')
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
      <div className="file-edit-form">
        <div className="file-meta-grid">
          <div>
            <label className="label label--xs">Type</label>
            <select className="input input--sm" value={editType} onChange={e => handleTypeChange(e.target.value)}>
              {FILE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label label--xs">Label</label>
            <input className="input input--sm" value={editLabel} onChange={e => setEditLabel(e.target.value)} />
          </div>
          <div>
            <label className="label label--xs">Key</label>
            <select className="input input--sm" value={editKey} onChange={e => setEditKey(e.target.value)}>
              <option value="">No key</option>
              {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
        <div className="link-edit-footer">
          <button type="button" onClick={() => onDelete(file.id)} className="btn btn-secondary btn-sm btn-danger-text btn-xs-text">
            <Trash2 size={13} /> Delete
          </button>
          <div className="btn-group">
            <button type="button" onClick={() => setEditing(false)} className="btn btn-secondary btn-sm btn-xs-text">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm btn-xs-text">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="file-row-display">
      <button
        onClick={() => onView ? onView(file.id, file.label, file.key_of) : onDownload(file.id, file.label)}
        disabled={!onView && downloadingId === file.id}
        className="download-btn"
      >
        {!onView && <Download size={14} />}
        {!onView && downloadingId === file.id ? 'Downloading…' : file.label}
        {file.key_of && file.key_of !== defaultKey && <KeyBadge keyOf={file.key_of} />}
      </button>
      {isAdmin && (
        <button
          onClick={openEdit}
          className="modal-close"
          title="Edit file details"
        >
          <Edit size={14} />
        </button>
      )}
    </div>
  )
}
