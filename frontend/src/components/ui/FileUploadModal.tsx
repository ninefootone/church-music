'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { X, Upload, File, Trash2, Music } from 'lucide-react'
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


// Rehearsal recordings — the church's OWN recordings only (see claude/rehearsal-recordings.md).
// Limits mirror backend/routes/uploads.js; the server enforces them too.
const AUDIO_RE = /\.(m4a|mp3|aac|wav)$/i
const DOC_MAX_BYTES = 20 * 1024 * 1024
const AUDIO_MAX_BYTES = 50 * 1024 * 1024

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1).replace(/\.0$/, '')}GB`
  return `${Math.max(0, Math.round(bytes / (1024 * 1024)))}MB`
}

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
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null)
  const [confirmOwn, setConfirmOwn] = useState(false)
  const [formError, setFormError] = useState('')

  const ACCEPTED = /\.(pdf|cho|chordpro|txt|m4a|mp3|aac|wav)$/i

  // How much of the church's recordings allowance is used (shown under the drop zone).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = await getToken()
        setAuthToken(token)
        const { data } = await api.get('/api/uploads/recordings/usage')
        if (!cancelled) setUsage(data)
      } catch {
        // Not essential — the server still enforces the limit.
      }
    })()
    return () => { cancelled = true }
  }, [getToken])

  const addFiles = (files: File[]) => {
    const valid = files.filter(f => ACCEPTED.test(f.name))
    const skipped = files.filter(f => !ACCEPTED.test(f.name))
    setFormError(skipped.length
      ? `Skipped ${skipped.map(f => f.name).join(', ')} — only PDF, ChordPro or audio (m4a, mp3, aac, wav) files can be uploaded.`
      : '')
    if (!valid.length) return

    const newEntries: FileEntry[] = valid.map(f => {
      const isChordPro = /\.(cho|chordpro)$/i.test(f.name)
      const isAudio = AUDIO_RE.test(f.name)
      return {
        id: Math.random().toString(36).slice(2),
        file: f,
        fileType: isAudio ? 'audio' : isChordPro ? 'chordpro' : 'chords',
        label: isAudio ? 'Recording' : isChordPro ? 'ChordPro' : 'Chord chart',
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

    const toUpload = entries.filter(e => e.status !== 'done')
    const tooBig = toUpload.find(e => e.file.size > (e.fileType === 'audio' ? AUDIO_MAX_BYTES : DOC_MAX_BYTES))
    if (tooBig) {
      updateEntry(tooBig.id, { status: 'error', error: tooBig.fileType === 'audio'
        ? 'Recordings can be up to 50MB — try saving it as m4a or mp3 rather than wav.'
        : 'PDF and ChordPro files can be up to 20MB.' })
      return
    }
    const audioBytes = toUpload.filter(e => e.fileType === 'audio').reduce((sum, e) => sum + e.file.size, 0)
    if (audioBytes > 0 && !confirmOwn) {
      setFormError('Please tick the box to confirm these are your own recordings.')
      return
    }
    if (usage && audioBytes > 0 && usage.used + audioBytes > usage.limit) {
      setFormError(`These recordings would take your church over its ${formatSize(usage.limit)} of rehearsal recordings (${formatSize(usage.used)} used). Delete some older recordings first.`)
      return
    }
    setFormError('')

    setUploading(true)

    let anyUploaded = false
    let anyFailed = false

    for (const entry of entries) {
      if (entry.status === 'done') continue
      updateEntry(entry.id, { status: 'uploading', error: undefined })
      try {
        const token = await getToken()
        setAuthToken(token)

        const formData = new FormData()
        formData.append('file', entry.file)
        formData.append('file_type', entry.fileType)
        formData.append('label', entry.label)
        formData.append('key_of', entry.keyOf)
        if (entry.fileType === 'audio') formData.append('confirm_own_recording', String(confirmOwn))

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
  const hasPendingAudio = entries.some(e => e.fileType === 'audio' && e.status !== 'done')

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
              accept=".pdf,.cho,.chordpro,.txt,.m4a,.mp3,.aac,.wav"
              multiple
              onChange={handleFilesChange}
              className="visually-hidden-input"
            />
            <Upload size={24} className="empty-icon" />
            <p className="drop-zone-heading">
              {dragActive ? 'Drop files to add them' : 'Drag files here or click to choose'}
            </p>
            <p className="drop-zone-hint">PDF or ChordPro (max 20MB) · rehearsal recordings: m4a, mp3, aac or wav (max 50MB) · multiple files supported</p>
          </div>

          <div className="info-box">
            <p className="info-box-text">
              <strong>Rehearsal recordings:</strong> only upload recordings your own team has made — for example a voice memo
              of the guitar or piano and vocal, in the key you play it. To point people to the original song, use
              {' '}<strong>Add link</strong> on the song page for Spotify, Apple Music or YouTube instead.
              {usage && <><br />Your church has used {formatSize(usage.used)} of {formatSize(usage.limit)} for recordings.</>}
            </p>
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
                    {entry.fileType === 'audio'
                      ? <Music size={15} className="icon-muted" />
                      : <File size={15} className="icon-muted" />}
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
                      {/* File type — audio is always a rehearsal recording */}
                      <div>
                        <label className="label">Type</label>
                        {entry.fileType === 'audio' ? (
                          // A one-option disabled select so it lines up exactly with the Label/Key fields.
                          <select className="input input--sm" value="audio" disabled aria-label="Type: recording">
                            <option value="audio">Recording</option>
                          </select>
                        ) : (
                        <select
                          className="input input--sm"
                          value={entry.fileType}
                          onChange={e => handleFileTypeChange(entry.id, e.target.value)}
                          disabled={entry.status === 'uploading'}
                        >
                          {FILE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        )}
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

          {hasPendingAudio && (
            <div className="checkbox-row">
              <input
                type="checkbox"
                id="confirm_own_recording"
                checked={confirmOwn}
                onChange={e => { setConfirmOwn(e.target.checked); setFormError('') }}
                disabled={uploading}
              />
              <label htmlFor="confirm_own_recording" className="checkbox-label">
                These are recordings our church made (or we have permission to share them) — not copies of a commercial track.
              </label>
            </div>
          )}

          {formError && <p className="input-error">{formError}</p>}

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
              disabled={uploading || pendingCount === 0 || (hasPendingAudio && !confirmOwn)}
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
