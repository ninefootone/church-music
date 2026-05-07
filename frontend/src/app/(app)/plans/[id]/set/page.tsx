'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, FileText, Loader2, Code, Play } from 'lucide-react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useChurch } from '@/context/ChurchContext'

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

export default function SetModePage() {
  const { id } = useParams()

  const [plan, setPlan] = useState<any>(null)
  const [filesMap, setFilesMap] = useState<Record<string, SongFile[]>>({})
  const [selected, setSelected] = useState<Record<string, Set<string>>>({})
  const [chordProKeys, setChordProKeys] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [merging, setMerging] = useState(false)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const { loading: churchLoading } = useChurch()

  useEffect(() => {
    if (!id || churchLoading) return
    api.get(`/api/plans/${id}`)
      .then(async r => {
        const svc = r.data
        setPlan(svc)

        const songItems: SongItem[] = (svc.items || []).filter(
          (item: SongItem) => item.type === 'song' && item.song_id
        )

        const results = await Promise.allSettled(
          songItems.map((item: SongItem) =>
            api.get(`/api/uploads/public/songs/${item.song_id}/files`)
              .then(res => ({ songId: item.song_id!, files: res.data as SongFile[] }))
          )
        )

        const newFilesMap: Record<string, SongFile[]> = {}
        const newSelected: Record<string, Set<string>> = {}

        results.forEach(result => {
          if (result.status === 'fulfilled') {
            const { songId, files } = result.value
            const songItem = songItems.find(s => s.song_id === songId)
            const songKey = songItem?.key_override || songItem?.song_default_key || null
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
        const savedSelections = sessionStorage.getItem(`setSelections-${id}`)
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
        const savedKeys = sessionStorage.getItem(`setChordProKeys-${id}`)
        if (savedKeys) setChordProKeys(JSON.parse(savedKeys))
      })
      .catch(() => setError('Could not load plan.'))
      .finally(() => setLoading(false))
  }, [id, churchLoading])

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
    sessionStorage.setItem(`setSelections-${id}`, JSON.stringify(selectionsToSave))
    sessionStorage.setItem(`setChordProKeys-${id}`, JSON.stringify(chordProKeys))
    sessionStorage.setItem('setViewerFiles', JSON.stringify(setFiles))
    router.push(`/plans/${id}/set/view`)
  }

  if (loading) return (
    <div style={{ padding: 'var(--space-xl)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)' }}>
      <Loader2 size={16} className="spin" /> Loading…
    </div>
  )

  if (!plan) return (
    <div style={{ padding: 'var(--space-xl)' }}>
      <p className="text-muted" style={{ marginBottom: 'var(--space-md)' }}>{error || 'Plan not found.'}</p>
      <Link href="/plans" className="back-link"><ArrowLeft size={14} /> Back to plans</Link>
    </div>
  )

  const songItems: SongItem[] = (plan.items || []).filter(
    (item: SongItem) => item.type === 'song' && item.song_id
  )

  return (
    <div>
      <Link href={`/plans/${id}`} className="back-link">
        <ArrowLeft size={14} /> Back to plan
      </Link>

      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>
          Set mode
        </h1>
        <p style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-secondary)' }}>
          {format(parseISO(plan.plan_date), 'd MMMM yyyy')}
          {plan.plan_time && ` · ${plan.plan_time}`}
          {plan.title && ` · ${plan.title}`}
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 8 }}>
          Choose which files to include for each song, then open in the set viewer.
        </p>
      </div>

      {songItems.length === 0 ? (
        <div className="card">
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            No songs in this plan.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
          {songItems.map((item, index) => {
            const files = filesMap[item.song_id!] || []
            const selectedIds = selected[item.song_id!] || new Set()

            return (
              <div key={item.id} className="card" style={{ padding: 'var(--space-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: files.length > 0 ? 'var(--space-sm)' : 0 }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', width: 20, flexShrink: 0 }}>
                    {index + 1}
                  </span>
                  <span style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text-primary)', flex: 1, minWidth: 0 }}>
                    {item.song_title}
                  </span>
                  {(item.key_override || item.song_default_key) && (
                    <span className="badge-key" style={{ flexShrink: 0 }}>
                      {item.key_override || item.song_default_key}
                    </span>
                  )}
                </div>

                {files.length === 0 ? (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic', paddingLeft: 30 }}>
                    No files uploaded
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 30 }}>
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
                          ? <Code size={13} style={{ color: 'var(--color-brand-500)', flexShrink: 0 }} />
                          : <FileText size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                        }
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)', flex: 1 }}>
                          {file.label}
                        </span>
                        {file.file_type === 'chordpro' && selectedIds.has(file.id) && (
                          <select
                            value={chordProKeys[file.id] || ''}
                            onChange={e => setChordProKeys(prev => ({ ...prev, [file.id]: e.target.value }))}
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: 'var(--text-xs)', padding: '2px 4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', flexShrink: 0 }}
                          >
                            <option value="">No transpose</option>
                            {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                        )}
                        {file.key_of && (
                          <span className="badge-key" style={{ fontSize: 'var(--text-xs)' }}>{file.key_of}</span>
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
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)', marginBottom: 'var(--space-md)' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Link href={`/plans/${id}`} className="btn btn-secondary">
          Cancel
        </Link>
        <button
          className="btn btn-primary"
          onClick={handleOpenSet}
          disabled={selectedCount === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Play size={14} />
          {`Open set (${selectedCount} ${selectedCount === 1 ? 'file' : 'files'})`}
        </button>
      </div>
    </div>
  )
}
