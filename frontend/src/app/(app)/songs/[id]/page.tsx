'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, Download, ExternalLink, Edit, Plus } from 'lucide-react'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
import { Song } from '@/types'
import api from '@/lib/api'
import { useChurch } from '@/context/ChurchContext'

export default function SongDetailPage() {
  const { id } = useParams()
  const { isAdmin } = useChurch()
  const [song, setSong] = useState<Song | null>(null)
  const [loading, setLoading] = useState(true)
  const [showFullLyrics, setShowFullLyrics] = useState(false)

  useEffect(() => {
    if (!id) return
    api.get(`/api/songs/${id}`)
      .then(r => setSong(r.data))
      .catch(err => console.error('Failed to fetch song:', err))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="loading-state">Loading…</div>
  if (!song) return <div className="loading-state">Song not found.</div>

  const mainFiles = (song.files || []).filter(f => f.key_of === song.default_key)
  const otherFiles = (song.files || []).filter(f => f.key_of !== song.default_key)

  const metaRow = (label: string, children: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
      <span className="meta-key">{label}</span>
      {children}
    </div>
  )

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Link href="/songs" className="back-link">
        <ArrowLeft size={13} /> Back to songs
      </Link>

      {/* Header card */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
          <h1 className="detail-title">{song.title}</h1>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginTop: 4 }}>
              <Link href={`/songs/${song.id}/edit`} className="btn btn-sm btn-secondary"><Edit size={13} /> Edit</Link>
              <button className="btn btn-sm btn-primary"><Plus size={13} /> Add to service</button>
            </div>
          )}
        </div>

        <div className="item-meta" style={{ fontSize: 15, marginBottom: 'var(--space-md)' }}>{song.author}</div>

        <div style={{ borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', padding: 'var(--space-md) 0', marginBottom: 'var(--space-md)', display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {song.category && metaRow('Category', <CategoryBadge category={song.category} />)}
          {song.default_key && metaRow('Key',
            <>
              <KeyBadge keyOf={song.default_key} />
              {otherFiles.length > 0 && <span className="item-meta">Other keys: {[...new Set(otherFiles.map(f => f.key_of))].join(', ')}</span>}
            </>
          )}
          {song.first_line && metaRow('First line', <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>"{song.first_line}"</span>)}
          {song.tags && song.tags.length > 0 && metaRow('Tags',
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
              {song.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}
            </div>
          )}
          {song.ccli_number && metaRow('CCLI',
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{song.ccli_number}</span>
              <a href={`https://songselect.ccli.com/songs/${song.ccli_number}`} target="_blank" rel="noopener noreferrer" className="ccli-link">
                View on SongSelect <ExternalLink size={11} />
              </a>
            </div>
          )}
        </div>

        {/* Lyrics */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="section-label">Lyrics</span>
            {song.lyrics && (
              <button onClick={() => setShowFullLyrics(!showFullLyrics)} className="btn-inline">
                {showFullLyrics ? 'Collapse' : 'Show full lyrics'}
              </button>
            )}
          </div>
          {song.lyrics ? (
            <div style={{ position: 'relative' }}>
              <div className="lyrics" style={{ maxHeight: showFullLyrics ? 'none' : 120, overflow: 'hidden' }}>
                {song.lyrics}
              </div>
              {!showFullLyrics && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, background: 'linear-gradient(transparent, white)' }} />
              )}
            </div>
          ) : (
            <p className="text-empty">
              No lyrics added yet.{song.ccli_number && <> Find them on <a href={`https://songselect.ccli.com/songs/${song.ccli_number}`} target="_blank" rel="noopener noreferrer" className="link-brand">SongSelect ↗</a> and add them by editing this song.</>}
            </p>
          )}
        </div>
      </div>

      {/* Downloads */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="section-label" style={{ marginBottom: 'var(--space-md)' }}>Downloads</div>

        {mainFiles.length > 0 && (
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <div className="subsection-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Main key — <KeyBadge keyOf={song.default_key} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {mainFiles.map(f => (
                <button key={f.id} className="download-btn">
                  <Download size={13} style={{ opacity: 0.6 }} /> {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {otherFiles.length > 0 && (
          <>
            <div style={{ borderTop: '1px solid var(--color-border)', margin: 'var(--space-md) 0' }} />
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <div className="subsection-label">Other keys</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {otherFiles.map(f => (
                  <button key={f.id} className="download-btn">
                    <Download size={13} style={{ opacity: 0.6 }} /> {f.label} <KeyBadge keyOf={f.key_of!} />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {mainFiles.length === 0 && otherFiles.length === 0 && (
          <p className="text-empty" style={{ marginBottom: 'var(--space-md)' }}>No files uploaded yet.</p>
        )}

        {song.youtube_url && (
          <>
            <div style={{ borderTop: '1px solid var(--color-border)', margin: 'var(--space-md) 0' }} />
            <div className="subsection-label">Reference</div>
            <a href={song.youtube_url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-neutral-50)', textDecoration: 'none' }}>
              <div style={{ width: 20, height: 20, background: '#e33', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '8px solid white', marginLeft: 2 }} />
              </div>
              <span className="item-title" style={{ marginBottom: 0 }}>YouTube reference video</span>
            </a>
          </>
        )}

        {isAdmin && (
          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)' }}>
            <button className="btn-inline" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Plus size={13} /> Upload a file
            </button>
          </div>
        )}
      </div>

      {/* Usage */}
      <div className="card">
        <div className="section-label" style={{ marginBottom: 'var(--space-md)' }}>Usage</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
          {[
            { value: song.usage?.times_sung || 0, label: 'Times sung' },
            { value: song.usage?.times_planned || 0, label: 'Planned' },
            { value: song.usage?.last_sung ? format(new Date(song.usage.last_sung), 'd MMM') : '—', label: 'Last sung' },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center', padding: 'var(--space-md)', background: 'var(--color-neutral-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
        {song.recent_services && song.recent_services.length > 0 && (
          <>
            <div className="subsection-label">Recent services</div>
            {song.recent_services.map((s: any, i: number) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < song.recent_services!.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <span className="item-meta" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{format(new Date(s.date), 'd MMMM yyyy')}</span>
                {s.key_used && <KeyBadge keyOf={s.key_used} />}
                <span className="item-meta">{s.service_time}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
