'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, FileText, Loader2, Code, Play } from 'lucide-react'
import { useRouter } from 'next/navigation'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL

interface SongFile {
  id: string
  label: string
  file_type: string
  key_of: string | null
  url: string
}

interface SongItem {
  id: string
  type: string
  song_id: string | null
  song_title: string | null
  key_override: string | null
  song_default_key: string | null
}

const KEYS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const FILE_TYPE_ORDER: Record<string, number> = {
  vocal: 0,
  lead: 1,
  chords: 2,
  full_score: 3,
}

function sortFiles(files: SongFile[], songKey?: string | null): SongFile[] {
  return [...files].sort((a, b) => {
    const aAlt = songKey && a.key_of && a.key_of !== songKey ? 1 : 0
    const bAlt = songKey && b.key_of && b.key_of !== songKey ? 1 : 0
    if (aAlt !== bAlt) return aAlt - bAlt
    const aOrder = FILE_TYPE_ORDER[a.file_type] ?? 99
    const bOrder = FILE_TYPE_ORDER[b.file_type] ?? 99
    return aOrder - bOrder
  })
}

export default function PublicSetModePage() {
  const { token } = useParams()

  const [plan, setPlan] = useState<any>(null)
  const [filesMap, setFilesMap] = useState<Record<string, SongFile[]>>({})
  const [selected, setSelected] = useState<Record<string, Set<string>>>({})
  const [chordProKeys, setChordProKeys] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    axios.get(`${API}/api/plans/public/${token}`)
      .then(async r => {
        const svc = r.data
        setPlan(svc)

        const songItems: SongItem[] = (svc.items || []).filter(
          (item: SongItem) => item.type === 'song' && item.song_id
        )

        const results = await Promise.allSettled(
          songItems.map((item: SongItem) =>
            axios.get(`${API}/api/uploads/public/songs/${item.song_id}/files`)
              .then(res => ({ songId: item.song_id!, files: res.data as SongFile[], item }))
          )
        )

        const newFilesMap: Record<string, SongFile[]> = {}
        const newSelected: Record<string, Set<string>> = {}

        results.forEach(result => {
          if (result.status === 'fulfilled') {
            const { songId, files, item } = result.value
            const songKey = item.key_override || item.song_default_key || null
            const pdfs = sortFiles(files, songKey)
            newFilesMap[songId] = pdfs
            newSelected[songId] = new Set()
            pdfs.forEach(f => {
              if (f.file_type === 'chordpro' && songKey) {
                setChordProKeys(prev => ({ ...prev, [f.id]: songKey }))
              }
            })
          }
        })

        setFilesMap(newFilesMap)

        // Restore saved selections if available
        const savedSelections = sessionStorage.getItem(`setSelections-${token}`)
        if (savedSelections) {
          const parsed = JSON.parse(savedSelections) as Record<string, string[]>
          const restored: Record<string, Set<string>> = {}
          Object.entries(parsed).forEach(([songId, fileIds]) => {
            restored[songId] = new Set(fileIds)
          })
          setSelected(restored)
        } else {
          setSelected(newSelected)
        }
        const savedKeys = sessionStorage.getItem(`setChordProKeys-${token}`)
        if (savedKeys) setChordProKeys(JSON.parse(savedKeys))
      })
      .catch(() => setError('Could not load plan.'))
      .finally(() => setLoading(false))
  }, [token])

  const toggleFile = (songId: string, fileId: string) => {
    setSelected(prev => {
      const next = new Set(prev[songId] || [])
      if (next.has(fileId)) {
        next.delete(fileId)
      } else {
        next.add(fileId)
      }
      return { ...prev, [songId]: next }
    })
  }

  const selectedCount = Object.values(selected).reduce((sum, set) => sum + set.size, 0)

  const handleOpenSet = () => {
    const songItems: SongItem[] = (plan.items || []).filter(
      (item: SongItem) => item.type === 'song' && item.song_id
    )

    const setFiles: { url: string; label: string; file_type: string; songTitle: string; songKey: string | null }[] = []

    for (const item of songItems) {
      const songId = item.song_id!
      const files = filesMap[songId] || []
      const selectedIds = selected[songId] || new Set()
      const songKey = item.key_override || item.song_default_key || null
      const chosenFiles = files.filter(f => selectedIds.has(f.id))
      chosenFiles.forEach(f => {
        setFiles.push({
          url: f.url,
          label: f.label,
          file_type: f.file_type,
          songTitle: item.song_title || '',
          songKey: f.file_type === 'chordpro' ? (chordProKeys[f.id] || songKey) : songKey,
        })
      })
    }

    if (setFiles.length === 0) {
      setError('No files selected.')
      return
    }

    // Save selections for restoration when returning
    const selectionsToSave: Record<string, string[]> = {}
    Object.entries(selected).forEach(([songId, fileIds]) => {
      selectionsToSave[songId] = Array.from(fileIds)
    })
    sessionStorage.setItem(`setSelections-${token}`, JSON.stringify(selectionsToSave))
    sessionStorage.setItem(`setChordProKeys-${token}`, JSON.stringify(chordProKeys))
    sessionStorage.setItem('setViewerFiles', JSON.stringify(setFiles))
    router.push(`/s/${token}/set/view`)
  }

  if (loading) return (
    <div className="fullscreen-center">
      <Loader2 size={16} className="spin" /> Loading…
    </div>
  )

  if (!plan) return (
    <div className="fullscreen-center">
      <p className="text-muted">Plan not found.</p>
    </div>
  )

  const songItems: SongItem[] = (plan.items || []).filter(
    (item: SongItem) => item.type === 'song' && item.song_id
  )

  return (
    <div className="app-shell">
      <nav className="public-nav">
        <div className="public-nav-inner">
          <img src="/logo.svg" alt="Song Stack" className="public-nav-logo" />
          <span className="public-nav-label">Set mode</span>
        </div>
      </nav>

      <main className="public-main">
        <a href={`/s/${token}`} className="back-link">
          <ArrowLeft size={14} /> Back to plan
        </a>

        <div className="set-mode-header">
          <h1 className="page-title">
            Set mode
          </h1>
          <p className="plan-detail-meta">
            {format(parseISO(plan.plan_date), 'd MMMM yyyy')}
            {plan.plan_time && ` · ${plan.plan_time}`}
            {plan.title && ` · ${plan.title}`}
          </p>
          <p className="set-instructions">
            Choose which files to include for each song, then open in the set viewer.
          </p>
        </div>

        {songItems.length === 0 ? (
          <p className="form-empty-note text-muted">
            No songs in this plan.
          </p>
        ) : (
          <div className="set-song-list">
            {songItems.map((item, index) => {
              const files = filesMap[item.song_id!] || []
              const selectedIds = selected[item.song_id!] || new Set()

              return (
                <div key={item.id} className="set-song-card">
                  <div
                    className="set-song-header"
                    style={{ marginBottom: files.length > 0 ? 'var(--space-sm)' : 0 }}
                  >
                    <span className="item-index">
                      {index + 1}
                    </span>
                    <span className="set-song-title">
                      {item.song_title}
                    </span>
                    {(item.key_override || item.song_default_key) && (
                      <span className="badge-key badge-key--shrink">
                        {(item.key_override || item.song_default_key || '').replace(/♯/g, '#').replace(/♭/g, 'b')}
                      </span>
                    )}
                  </div>

                  {files.length === 0 ? (
                    <p className="set-no-files">
                      No files uploaded
                    </p>
                  ) : (
                    <div className="set-file-list">
                      {files.map(file => (
                        <label
                          key={file.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: selectedIds.has(file.id) ? 'var(--color-brand-50, #eff6ff)' : 'var(--color-neutral-50)', border: `1px solid ${selectedIds.has(file.id) ? 'var(--color-brand-200, #bfdbfe)' : 'var(--color-border)'}`, transition: 'all var(--transition-fast)' }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(file.id)}
                            onChange={() => toggleFile(item.song_id!, file.id)}
                            style={{ width: 16, height: 16, accentColor: 'var(--color-brand-600)', flexShrink: 0 }}
                          />
                          {file.file_type === 'chordpro'
                          ? <Code size={13} className="icon-brand" />
                          : <FileText size={13} className="icon-muted" />
                        }
                        <span className="set-file-label">
                          {file.label}
                        </span>
                        {file.file_type === 'chordpro' && selectedIds.has(file.id) && (
                          <select
                            value={chordProKeys[file.id] || ''}
                            onChange={e => setChordProKeys(prev => ({ ...prev, [file.id]: e.target.value }))}
                            onClick={e => e.stopPropagation()}
                            className="transpose-select"
                          >
                            <option value="">No transpose</option>
                            {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                        )}
                          {file.key_of && (
                            <span className="badge-key badge-key--xs">
                              {file.key_of.replace(/♯/g, '#').replace(/♭/g, 'b')}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {error && (
          <p className="error-text">
            {error}
          </p>
        )}

        <div className="set-footer-actions">
          <a href={`/s/${token}`} className="btn-cancel">
            Cancel
          </a>
          <button
            className="btn-open-set"
            style={{ background: selectedCount === 0 ? 'var(--color-neutral-300)' : 'var(--color-brand-600)', cursor: selectedCount === 0 ? 'not-allowed' : 'pointer' }}
            onClick={handleOpenSet}
            disabled={selectedCount === 0}
          >
            <Play size={14} />
            {`Open set (${selectedCount} ${selectedCount === 1 ? 'file' : 'files'})`}
          </button>
        </div>
      </main>

      <footer className="app-footer">
        Song Stack &mdash; shared by your church
      </footer>
    </div>
  )
}
