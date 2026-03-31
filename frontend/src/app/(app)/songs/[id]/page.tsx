'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Download, ExternalLink, Edit, Plus } from 'lucide-react'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
import { LyricsDisplay } from '@/components/ui/LyricsDisplay'
import { Song } from '@/types'
import api from '@/lib/api'
import { useChurch } from '@/context/ChurchContext'

export default function SongDetailPage() {
  const { id } = useParams()
  const { isAdmin, loading: churchLoading } = useChurch()
  const [song, setSong] = useState<Song | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showFullLyrics, setShowFullLyrics] = useState(false)

  useEffect(() => {
    // Wait for church context to finish loading before fetching
    if (!id || churchLoading) return
    setLoading(true)
    setNotFound(false)
    api.get(`/api/songs/${id}`)
      .then(r => setSong(r.data))
      .catch(err => {
        console.error('Failed to fetch song:', err)
        setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [id, churchLoading])

  if (loading || churchLoading) return (
    <p className="text-muted" style={{ padding: 'var(--space-xl)' }}>Loading…</p>
  )
  if (notFound || !song) return (
    <div style={{ padding: 'var(--space-xl)' }}>
      <p className="text-muted" style={{ marginBottom: 'var(--space-md)' }}>Song not found.</p>
      <Link href="/songs" className="back-link"><ArrowLeft size={14} /> Back to songs</Link>
    </div>
  )

  const mainFiles = (song.files || []).filter(f => f.key_of === song.default_key)
  const otherFiles = (song.files || []).filter(f => f.key_of !== song.default_key)

  return (
    <div style={{ maxWidth: 'var(--width-app)', margin: '0 auto' }}>
      <Link href="/songs" className="back-link"><ArrowLeft size={14} /> Back to songs</Link>

      {/* Header card */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="song-detail-header">
          <h1 className="song-detail-title">{song.title}</h1>
          {isAdmin && (
            <div className="song-detail-actions">
              <Link href={`/songs/${song.id}/edit`} className="btn btn-sm btn-secondary"><Edit size={14} /> Edit</Link>
              <button className="btn btn-sm btn-primary"><Plus size={14} /> Add to service</button>
            </div>
          )}
        </div>

        <p className="song-detail-author">{song.author}</p>

        <div className="meta-block">
          {song.category && (
            <div className="meta-row">
              <span className="meta-label">Category</span>
              <CategoryBadge category={song.category} />
            </div>
          )}
          {song.default_key && (
            <div className="meta-row">
              <span className="meta-label">Key</span>
              <KeyBadge keyOf={song.default_key} />
              {otherFiles.length > 0 && (
                <span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
                  Other keys: {[...new Set(otherFiles.map(f => f.key_of))].join(', ')}
                </span>
              )}
            </div>
          )}
          {song.first_line && (
            <div className="meta-row">
              <span className="meta-label">First line</span>
              <span className="first-line-text">&ldquo;{song.first_line}&rdquo;</span>
            </div>
          )}
          {song.tags && song.tags.length > 0 && (
            <div className="meta-row">
              <span className="meta-label">Tags</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {song.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}
              </div>
            </div>
          )}
          {song.ccli_number && (
            <div className="meta-row">
              <span className="meta-label">CCLI</span>
              <span className="ccli-number">{song.ccli_number}</span>
              <a
                href={`https://songselect.ccli.com/songs/${song.ccli_number}`}
                target="_blank" rel="noopener noreferrer"
                className="ccli-link"
              >
                View on SongSelect <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>

        {/* Lyrics */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="section-label" style={{ marginBottom: 0 }}>Lyrics</span>
            {song.lyrics && (
              <button onClick={() => setShowFullLyrics(!showFullLyrics)} className="btn btn-ghost">
                {showFullLyrics ? 'Collapse' : 'Show full lyrics'}
              </button>
            )}
          </div>
          {song.lyrics ? (
            <div style={{ position: 'relative' }}>
              <div style={{ maxHeight: showFullLyrics ? 'none' : 140, overflow: 'hidden' }}>
                <LyricsDisplay lyrics={song.lyrics} />
              </div>
              {!showFullLyrics && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 56, background: 'linear-gradient(transparent, white)', pointerEvents: 'none' }} />
              )}
            </div>
          ) : (
            <p className="text-muted" style={{ fontStyle: 'italic' }}>
              No lyrics added yet.{' '}
              {song.ccli_number && (
                <a href={`https://songselect.ccli.com/songs/${song.ccli_number}`} target="_blank" rel="noopener noreferrer" className="link">
                  Find them on SongSelect ↗
                </a>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Downloads */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="section-label">Downloads</div>

        {mainFiles.length > 0 && (
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <p className="downloads-group-label">Main key — <KeyBadge keyOf={song.default_key} /></p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {mainFiles.map(f => (
                <button key={f.id} className="download-btn"><Download size={14} /> {f.label}</button>
              ))}
            </div>
          </div>
        )}

        {otherFiles.length > 0 && (
          <>
            <div className="divider" />
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <p className="downloads-group-label">Other keys</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {otherFiles.map(f => (
                  <button key={f.id} className="download-btn">
                    <Download size={14} /> {f.label} <KeyBadge keyOf={f.key_of!} />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {mainFiles.length === 0 && otherFiles.length === 0 && (
          <p className="text-muted" style={{ fontStyle: 'italic', marginBottom: 'var(--space-md)' }}>No files uploaded yet.</p>
        )}

        {song.youtube_url && (
          <>
            <div className="divider" />
            <p className="downloads-group-label">Reference</p>
            <a href={song.youtube_url} target="_blank" rel="noopener noreferrer" className="youtube-link">
              <span className="youtube-icon"><span className="youtube-play" /></span>
              YouTube reference video
            </a>
          </>
        )}

        {isAdmin && (
          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)' }}>
            <button className="btn btn-ghost"><Plus size={14} /> Upload a file</button>
          </div>
        )}
      </div>

      {/* Usage */}
      <div className="card">
        <div className="section-label">Usage</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
          <div className="stat-box">
            <div className="stat-number">{song.usage?.times_sung || 0}</div>
            <div className="stat-label">Times sung</div>
          </div>
          <div className="stat-box">
            <div className="stat-number">{song.usage?.times_planned || 0}</div>
            <div className="stat-label">Planned</div>
          </div>
          <div className="stat-box">
            <div className="stat-number">{song.usage?.last_sung ? format(parseISO(song.usage.last_sung), 'd MMM') : '—'}</div>
            <div className="stat-label">Last sung</div>
          </div>
        </div>
        {song.recent_services && song.recent_services.length > 0 && (
          <>
            <p className="downloads-group-label">Recent services</p>
            {song.recent_services.map((s: any, i: number) => (
              <Link key={s.id} href={`/services/${s.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < song.recent_services!.length - 1 ? '1px solid var(--color-border)' : 'none', textDecoration: 'none' }}>
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)' }}>
                  {s.service_date ? format(parseISO(s.service_date), 'd MMMM yyyy') : ''}
                </span>
                {s.key_override && <KeyBadge keyOf={s.key_override} />}
                <span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>{s.service_time}</span>
              </Link>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
