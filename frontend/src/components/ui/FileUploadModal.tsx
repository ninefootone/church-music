'use client'

import { useState, useRef } from 'react'
import { X, Upload, File } from 'lucide-react'
import api from '@/lib/api'

const FILE_TYPES = [
  { value: 'chords',     label: 'Chord chart' },
  { value: 'lead',       label: 'Lead sheet' },
  { value: 'vocal',      label: 'Vocal sheet' },
  { value: 'full_score', label: 'Full score' },
]

const KEYS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

interface FileUploadModalProps {
  songId: string
  defaultKey?: string
  onClose: () => void
  onUploaded: () => void
}

export function FileUploadModal({ songId, defaultKey, onClose, onUploaded }: FileUploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState('chords')
  const [label, setLabel] = useState('')
  const [keyOf, setKeyOf] = useState(defaultKey || '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    // Auto-set label from file type if not set
    if (!label) {
      const match = FILE_TYPES.find(t => t.value === fileType)
      setLabel(match?.label || '')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setError('Please select a file'); return }
    if (!label) { setError('Please add a label'); return }

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('file_type', fileType)
      formData.append('label', label)
      formData.append('key_of', keyOf)

      await api.post(`/api/uploads/songs/${songId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      onUploaded()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed')
      setUploading(false)
    }
  }

  // Auto-update label when file type changes
  const handleFileTypeChange = (val: string) => {
    setFileType(val)
    const match = FILE_TYPES.find(t => t.value === val)
    if (match) setLabel(match.label)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-md)' }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />

      {/* Modal */}
      <div style={{ position: 'relative', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
            Upload file
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* File picker */}
          <div
            onClick={() => inputRef.current?.click()}
            style={{ border: `2px dashed ${file ? 'var(--color-brand-400)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)', textAlign: 'center', cursor: 'pointer', background: file ? 'var(--color-brand-50)' : 'var(--color-neutral-50)', transition: 'all var(--transition-fast)' }}
          >
            <input ref={inputRef} type="file" accept=".pdf,image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <File size={20} style={{ color: 'var(--color-brand-500)', flexShrink: 0 }} />
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-brand-700)' }}>{file.name}</span>
              </div>
            ) : (
              <>
                <Upload size={24} style={{ color: 'var(--color-text-muted)', margin: '0 auto 8px' }} />
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Click to choose a file</p>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>PDF or image, max 20MB</p>
              </>
            )}
          </div>

          {/* File type */}
          <div>
            <label className="label">File type</label>
            <select className="input" value={fileType} onChange={e => handleFileTypeChange(e.target.value)}>
              {FILE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Label */}
          <div>
            <label className="label">Label</label>
            <input className="input" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Chord chart — E" />
          </div>

          {/* Key */}
          <div>
            <label className="label">Key <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>(optional)</span></label>
            <select className="input" value={keyOf} onChange={e => setKeyOf(e.target.value)}>
              <option value="">No specific key</option>
              {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 'var(--space-sm)' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              <Upload size={15} /> {uploading ? 'Uploading…' : 'Upload file'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
