'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, FileText, Loader2, Music } from 'lucide-react'
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

  const [service, setService] = useState<any>(null)
  const [filesMap, setFilesMap] = useState<Record<string, SongFile[]>>({})
  const [selected, setSelected] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(true)
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    axios.get(`${API}/api/services/public/${token}`)
      .then(async r => {
        const svc = r.data
        setService(svc)

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
            newSelected[songId] = new Set(pdfs.map(f => f.id))
          }
        })

        setFilesMap(newFilesMap)
        setSelected(newSelected)
      })
      .catch(() => setError('Could not load service.'))
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

  const handleOpenSet = async () => {
    setMerging(true)
    setError(null)
    try {
      const songItems: SongItem[] = (service.items || []).filter(
        (item: SongItem) => item.type === 'song' && item.song_id
      )

      const urlsToMerge: string[] = []
      for (const item of songItems) {
        const songId = item.song_id!
        const files = filesMap[songId] || []
        const selectedIds = selected[songId] || new Set()
        const chosenFiles = files.filter(f => selectedIds.has(f.id))
        chosenFiles.forEach(f => urlsToMerge.push(f.url))
      }

      if (urlsToMerge.length === 0) {
        setError('No files selected.')
        setMerging(false)
        return
      }

      const { PDFDocument } = await import('pdf-lib')

      const merged = await PDFDocument.create()

      for (const url of urlsToMerge) {
        try {
          const response = await fetch(url)
          if (!response.ok) throw new Error(`Failed to fetch ${url}`)
          const bytes = await response.arrayBuffer()
          const doc = await PDFDocument.load(bytes)
          const pages = await merged.copyPages(doc, doc.getPageIndices())
          pages.forEach(page => merged.addPage(page))
        } catch (fetchErr) {
          console.warn('Skipping file due to fetch error:', fetchErr)
        }
      }

      const mergedBytes = await merged.save()
      const blob = new Blob([mergedBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank')
    } catch (err) {
      console.error(err)
      setError('Something went wrong merging the PDFs. Please try again.')
    } finally {
      setMerging(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--color-text-muted)' }}>
      <Loader2 size={16} className="spin" /> Loading…
    </div>
  )

  if (!service) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="text-muted">Service not found.</p>
    </div>
  )

  const songItems: SongItem[] = (service.items || []).filter(
    (item: SongItem) => item.type === 'song' && item.song_id
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <nav style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', padding: '0 var(--space-lg)', height: 58, display: 'flex', alignItems: 'center' }}>
        <div style={{ maxWidth: 'var(--width-app)', margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.svg" alt="Song Stack" style={{ height: 22, borderRadius: 4 }} />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginLeft: 4 }}>Set mode</span>
        </div>
      </nav>

      <main style={{ maxWidth: 'var(--width-app)', margin: '0 auto', padding: 'var(--space-xl) var(--space-lg)' }}>
        
          <a href={`/s/${token}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: 'var(--space-lg)' }}>
          <ArrowLeft size={14} /> Back to service
        </a>

        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>
            Set mode
          </h1>
          <p style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-secondary)' }}>
            {format(parseISO(service.service_date), 'd MMMM yyyy')}
            {service.service_time && ` · ${service.service_time}`}
            {service.title && ` · ${service.title}`}
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 8 }}>
            Choose which files to include for each song, then open as a single PDF.
          </p>
        </div>

        {songItems.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            No songs in this service.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
            {songItems.map((item, index) => {
              const files = filesMap[item.song_id!] || []
              const selectedIds = selected[item.song_id!] || new Set()

              return (
                <div key={item.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: files.length > 0 ? 'var(--space-sm)' : 0 }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', width: 20, flexShrink: 0 }}>
                      {index + 1}
                    </span>
                    <Music size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text-primary)', flex: 1, minWidth: 0 }}>
                      {item.song_title}
                    </span>
                    {(item.key_override || item.song_default_key) && (
                      <span className="badge-key" style={{ flexShrink: 0 }}>
                        {(item.key_override || item.song_default_key || '').replace(/♯/g, '#').replace(/♭/g, 'b')}
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
                          <FileText size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)', flex: 1 }}>
                            {file.label}
                          </span>
                          {file.key_of && (
                            <span className="badge-key" style={{ fontSize: 'var(--text-xs)' }}>
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
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)', marginBottom: 'var(--space-md)' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          
            <a href={`/s/${token}`} style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 16px', background: 'var(--color-neutral-100)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
            Cancel
          </a>
          <button
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: selectedCount === 0 || merging ? 'var(--color-neutral-300)' : 'var(--color-brand-600)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: selectedCount === 0 || merging ? 'not-allowed' : 'pointer' }}
            onClick={handleOpenSet}
            disabled={merging || selectedCount === 0}
          >
            {merging ? (
              <><Loader2 size={15} className="spin" /> Merging…</>
            ) : (
              `Open set (${selectedCount} ${selectedCount === 1 ? 'file' : 'files'})`
            )}
          </button>
        </div>
      </main>

      <footer className="app-footer">
        Song Stack &mdash; shared by your church
      </footer>
    </div>
  )
}
