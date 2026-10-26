'use client'

import { useState, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { X, Upload, File, Trash2 } from 'lucide-react'
import api, { setAuthToken } from '@/lib/api'
import { KEYS } from '@/lib/keys'

const FILE_TYPES = [
  { value: 'chords',     label: 'Chord chart' },
  { value: 'lead',       label: 'Lead sheet' },
  { value: 'vocal',      label: 'Vocal sheet' },
  { value: 'full_score', label: 'Full score' },
  { value: 'chordpro',   label: 'ChordPro' },
  { value: 'other',      label: 'Other' },
]


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
  const { getToken } = useAuth()
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const ACCEPTED = /\.(pdf|cho|chordpro|txt)$/i

  const addFiles = (files: File[]) => {
    const valid = files.filter(f => ACCEPTED.test(f.name))
    if (!valid.length) return

    const newEntries: FileEntry[] = valid.map(f => {
      const isChordPro = /\.(cho|chordpro)$/i.test(f.name)
      return {
        id: Math.random().toString(36).slice(2),
        file: f,
        fileType: isChordPro ? 'chordpro' : 'chords',
        label: isChordPro ? 'ChordPro' : 'Chord chart',
        keyOf: defaultKey || '',
        status: 'pending' as const,
      }
    })

    setEntries(prev => [...prev, ...newEntries])
  }

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []))
    // Reset input so the same file can be re-added if needed
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!uploading) setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Ignore leave events fired when moving over child elements
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (uploading) return
    addFiles(Array.from(e.dataTransfer.files || []))
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
    let anyFailed = false

    for (const entry of entries) {
      updateEntry(entry.id, { status: 'uploading', error: undefined })
      try {
        const token = await getToken()
        setAuthToken(token)

        const formData = new FormData()
        formData.append('file', entry.file)
        formData.append('file_type', entry.fileType)
        formData.append('label', entry.label)
        formData.append('key_of', entry.keyOf)

        await api.post(`/api/uploads/songs/${songId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })

        updateEntry(entry.id, { status: 'done' })
        anyUploaded = true
      } catch (err: any) {
        anyFailed = true
        updateEntry(entry.id, { status: 'error', error: err.response?.data?.error || 'Upload failed' })
      }
    }

    setUploading(false)

    if (anyUploaded) onUploaded()

    // If all succeeded, close. If some failed, leave modal open so user can see errors.
    // (Tracked locally: `entries` is this render's snapshot, so reading statuses from
    // it here always saw 'pending' and closed the modal, hiding the error.)
    if (!anyFailed) onClose()
  }

  const pendingCount = entries.filter(e => e.status === 'pending' || e.status === 'error').length

  return (
    <div
      className="modal-overlay modal-overlay--front"
      onDragOver={e => e.preventDefault()}
      onDrop={e => e.preventDefault()}
    >
      <div onClick={onClose} className="modal-backdrop" />

      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">Upload files</h2>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">

          {/* Drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`drop-zone${dragActive ? ' drop-zone--active' : ''}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.cho,.chordpro,.txt"
              multiple
              onChange={handleFilesChange}
              className="visually-hidden-input"
            />
            <Upload size={24} className="empty-icon" />
            <p className="drop-zone-heading">
              {dragActive ? 'Drop files to add them' : 'Drag files here or click to choose'}
            </p>
            <p className="drop-zone-hint">PDF or ChordPro · max 20MB each · multiple files supported</p>
          </div>

          {/* File rows */}
          {entries.length > 0 && (
            <div className="form-stack form-stack--sm">
              {entries.map(entry => (
                <div
                  key={entry.id}
                  className="file-entry-card"
                  style={{
                    border: `1px solid ${entry.status === 'error' ? 'var(--color-danger)' : entry.status === 'done' ? 'var(--color-success)' : 'var(--color-border)'}`,
                    background: entry.status === 'done' ? 'var(--color-success-bg, #f0fdf4)' : 'var(--color-surface)',
                    opacity: entry.status === 'done' ? 0.7 : 1,
                  }}
                >
                  {/* Filename + remove */}
                  <div className="file-entry-header">
                    <File size={15} className="icon-muted" />
                    <span className="file-entry-name">{entry.file.name}</span>
                    {entry.status === 'uploading' && (
                      <span className="upload-status">Uploading…</span>
                    )}
                    {entry.status === 'done' && (
                      <span className="upload-status--done">Done</span>
                    )}
                    {entry.status !== 'done' && entry.status !== 'uploading' && (
                      <button
                        type="button"
                        onClick={() => removeEntry(entry.id)}
                        className="btn-icon-remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {entry.status !== 'done' && (
                    <div className="file-meta-grid">
                      {/* File type */}
                      <div>
                        <label className="label">Type</label>
                        <select
                          className="input input--sm"
                          value={entry.fileType}
                          onChange={e => handleFileTypeChange(entry.id, e.target.value)}
                          disabled={entry.status === 'uploading'}
                        >
                          {FILE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>

                      {/* Label */}
                      <div>
                        <label className="label">Label</label>
                        <input
                          className="input input--sm"
                          value={entry.label}
                          onChange={e => updateEntry(entry.id, { label: e.target.value })}
                          placeholder="e.g. Chord chart — E"
                          disabled={entry.status === 'uploading'}
                        />
                      </div>

                      {/* Key */}
                      <div>
                        <label className="label">Key</label>
                        <select
                          className="input input--sm"
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
                    <p className="input-error">{entry.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="ccli-notice">
            Please ensure you hold a valid{' '}
            <a href="https://ccli.com" target="_blank" rel="noopener noreferrer" className="link-brand">
              CCLI licence
            </a>
            {' '}that covers storing and sharing these files with your team.
          </p>

          <div className="modal-footer">
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
