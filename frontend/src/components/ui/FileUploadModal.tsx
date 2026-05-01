'use client'

import { useState, useRef } from 'react'
import { X, Upload, File, Trash2 } from 'lucide-react'
import api from '@/lib/api'

const FILE_TYPES = [
  { value: 'chords',     label: 'Chord chart' },
  { value: 'lead',       label: 'Lead sheet' },
  { value: 'vocal',      label: 'Vocal sheet' },
  { value: 'full_score', label: 'Full score' },
]

const KEYS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

interface FileEntry {
  id: string
  file: File
  fileType: string
  label: string
  keyOf: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

interface FileUploadModalProps {
  songId: string
  defaultKey?: string
  onClose: () => void
  onUploaded: () => void
}

export function FileUploadModal({ songId, defaultKey, onClose, onUploaded }: FileUploadModalProps) {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const newEntries: FileEntry[] = files.map(f => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      fileType: 'chords',
      label: 'Chord chart',
      keyOf: defaultKey || '',
      status: 'pending',
    }))

    setEntries(prev => [...prev, ...newEntries])
    // Reset input so the same file can be re-added if needed
    e.target.value = ''
  }

  const updateEntry = (id: string, patch: Partial<FileEntry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
  }

  const removeEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const handleFileTypeChange = (id: string, val: string) => {
    const match = FILE_TYPES.find(t => t.value === val)
    updateEntry(id, { fileType: val, label: match?.label || val })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entries.length) return

    const missing = entries.find(e => !e.label.trim())
    if (missing) {
      updateEntry(missing.id, { status: 'error', error: 'Label is required' })
      return
    }

    setUploading(true)

    let anyUploaded = false

    for (const entry of entries) {
      updateEntry(entry.id, { status: 'uploading', error: undefined })
      try {
        const formData = new FormData()
        formData.append('file', entry.file)
        formData.append('file_type', entry.fileType)
        formData.append('label', entry.label)
        formData.append('key_of', entry.keyOf)

        await api.post(`/api/uploads/songs/${songId}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': api.defaults.headers.common['Authorization'] as string,
            'x-church-id': api.defaults.headers.common['x-church-id'] as string,
          },
        })

        updateEntry(entry.id, { status: 'done' })
        anyUploaded = true
      } catch (err: any) {
        updateEntry(entry.id, { status: 'error', error: err.response?.data?.error || 'Upload failed' })
      }
    }

    setUploading(false)

    if (anyUploaded) onUploaded()

    // If all succeeded, close. If some failed, leave modal open so user can see errors.
    const stillPending = entries.some(e => e.status === 'error')
    if (!stillPending) onClose()
  }

  const pendingCount = entries.filter(e => e.status === 'pending' || e.status === 'error').length

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-md)' }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />

      {/* Modal */}
      <div style={{ position: 'relative', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
            Upload files
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

          {/* Drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed var(--color-border)`,
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-lg)',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'var(--color-neutral-50)',
              transition: 'all var(--transition-fast)',
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFilesChange}
              style={{ display: 'none' }}
            />
            <Upload size={24} style={{ color: 'var(--color-text-muted)', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Click to choose files
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              PDF only · max 20MB each · multiple files supported
            </p>
          </div>

          {/* File rows */}
          {entries.length > 0 && (
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
                  {/* Filename + remove */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-sm)' }}>
                    <File size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.file.name}
                    </span>
                    {entry.status === 'uploading' && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Uploading…</span>
                    )}
                    {entry.status === 'done' && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)' }}>Done</span>
                    )}
                    {entry.status !== 'done' && entry.status !== 'uploading' && (
                      <button
                        type="button"
                        onClick={() => removeEntry(entry.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2, display: 'flex', flexShrink: 0 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {entry.status !== 'done' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-sm)' }}>
                      {/* File type */}
                      <div>
                        <label className="label" style={{ fontSize: 'var(--text-xs)' }}>Type</label>
                        <select
                          className="input"
                          style={{ fontSize: 'var(--text-sm)', padding: '4px 8px' }}
                          value={entry.fileType}
                          onChange={e => handleFileTypeChange(entry.id, e.target.value)}
                          disabled={entry.status === 'uploading'}
                        >
                          {FILE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>

                      {/* Label */}
                      <div>
                        <label className="label" style={{ fontSize: 'var(--text-xs)' }}>Label</label>
                        <input
                          className="input"
                          style={{ fontSize: 'var(--text-sm)', padding: '4px 8px' }}
                          value={entry.label}
                          onChange={e => updateEntry(entry.id, { label: e.target.value })}
                          placeholder="e.g. Chord chart — E"
                          disabled={entry.status === 'uploading'}
                        />
                      </div>

                      {/* Key */}
                      <div>
                        <label className="label" style={{ fontSize: 'var(--text-xs)' }}>Key</label>
                        <select
                          className="input"
                          style={{ fontSize: 'var(--text-sm)', padding: '4px 8px' }}
                          value={entry.keyOf}
                          onChange={e => updateEntry(entry.id, { keyOf: e.target.value })}
                          disabled={entry.status === 'uploading'}
                        >
                          <option value="">No key</option>
                          {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {entry.error && (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', marginTop: 6 }}>{entry.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 'var(--space-sm)' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading || pendingCount === 0}
            >
              <Upload size={15} />
              {uploading
                ? 'Uploading…'
                : pendingCount === 1
                  ? 'Upload 1 file'
                  : `Upload ${pendingCount} files`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}