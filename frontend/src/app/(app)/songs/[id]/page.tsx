'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, Download, ExternalLink, Edit, Plus } from 'lucide-react'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
import { Category } from '@/types'

const song = {
  id: '1',
  title: '10,000 Reasons (Bless The Lord)',
  author: 'Jonas Myrin, Matt Redman',
  default_key: 'E',
  category: 'praise' as Category,
  first_line: 'Bless the Lord, O my soul, O my soul…',
  ccli_number: '6016351',
  youtube_url: 'https://www.youtube.com/watch?v=PLAN9NsS3I8',
  lyrics: `Verse 1\nBless the Lord, O my soul\nO my soul, worship His holy name\nSing like never before, O my soul\nI'll worship Your holy name\n\nChorus\n10,000 reasons for my heart to find\nBless the Lord, O my soul\nWorship His holy name\nSing like never before, O my soul\nI'll worship Your holy name`,
  tags: ['Thanksgiving', 'Trinity', 'New Wine 2024'],
  files: [
    { id: '1', file_type: 'chords', label: 'Chord chart', key_of: 'E' },
    { id: '2', file_type: 'lead', label: 'Lead sheet', key_of: 'E' },
    { id: '3', file_type: 'vocal', label: 'Vocal score', key_of: 'E' },
    { id: '4', file_type: 'full_score', label: 'Full score', key_of: 'E' },
    { id: '5', file_type: 'chords', label: 'Chord chart', key_of: 'A' },
    { id: '6', file_type: 'chords', label: 'Chord chart', key_of: 'D' },
    { id: '7', file_type: 'vocal', label: 'Vocal score', key_of: 'Bb' },
  ],
  usage: { times_sung: 14, times_planned: 3, last_sung: '2026-03-01' },
  recent_services: [
    { id: '1', date: '2026-03-01', key_used: 'E', service_time: '9.15am' },
    { id: '2', date: '2026-01-19', key_used: 'E', service_time: '9.15am' },
    { id: '3', date: '2025-11-03', key_used: 'A', service_time: '9.15am' },
    { id: '4', date: '2025-09-14', key_used: 'E', service_time: '9.15am' },
  ],
}

export default function SongDetailPage() {
  const [showFullLyrics, setShowFullLyrics] = useState(false)
  const mainFiles = song.files.filter(f => f.key_of === song.default_key)
  const otherFiles = song.files.filter(f => f.key_of !== song.default_key)

  const metaRow = (label: string, children: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: 'var(--color-text-muted)', width: 80, flexShrink: 0 }}>
        {label}
      </span>
      {children}
    </div>
  )

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Link href="/songs" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: 'var(--space-lg)' }}>
        <ArrowLeft size={13} /> Back to songs
      </Link>

      {/* Header card */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            {song.title}
          </h1>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginTop: 4 }}>
            <Link href={`/songs/${song.id}/edit`} className="btn btn-sm btn-secondary"><Edit size={13} /> Edit</Link>
            <button className="btn btn-sm btn-primary"><Plus size={13} /> Add to service</button>
          </div>
        </div>

        <div style={{ fontSize: 15, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>{song.author}</div>

        {/* Meta */}
        <div style={{ borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', padding: 'var(--space-md) 0', marginBottom: 'var(--space-md)', display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {metaRow('Category', <CategoryBadge category={song.category} />)}
          {metaRow('Key',
            <>
              <KeyBadge keyOf={song.default_key} />
              {otherFiles.length > 0 && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Other keys: {[...new Set(otherFiles.map(f => f.key_of))].join(', ')}</span>}
            </>
          )}
          {song.first_line && metaRow('First line', <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>"{song.first_line}"</span>)}
          {song.tags.length > 0 && metaRow('Tags',
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
              {song.tags.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
          )}
          {song.ccli_number && metaRow('CCLI',
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{song.ccli_number}</span>
              <a href={`https://songselect.ccli.com/songs/${song.ccli_number}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: 'var(--color-brand-500)', background: 'var(--color-brand-50)', border: '1px solid var(--color-brand-100)', padding: '4px 12px', borderRadius: 'var(--radius-pill)', textDecoration: 'none' }}>
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
              <button onClick={() => setShowFullLyrics(!showFullLyrics)} style={{ fontSize: 12, color: 'var(--color-brand-500)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                {showFullLyrics ? 'Collapse' : 'Show full lyrics'}
              </button>
            )}
          </div>
          {song.lyrics ? (
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: showFullLyrics ? 'none' : 120, overflow: 'hidden' }}>
                {song.lyrics}
              </div>
              {!showFullLyrics && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, background: 'linear-gradient(transparent, white)' }} />
              )}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No lyrics added yet.{' '}
              <a href={`https://songselect.ccli.com/songs/${song.ccli_number}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-brand-500)' }}>
                Find them on SongSelect
              </a>{' '}and paste them in when editing this song.
            </p>
          )}
        </div>
      </div>

      {/* Downloads card */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="section-label" style={{ marginBottom: 'var(--space-md)' }}>Downloads</div>

        {mainFiles.length > 0 && (
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              Main key — <KeyBadge keyOf={song.default_key} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {mainFiles.map(f => (
                <button key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'inherit', cursor: 'pointer' }}>
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
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Other keys</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {otherFiles.map(f => (
                  <button key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', fontFamily: 'inherit', cursor: 'pointer' }}>
                    <Download size={13} style={{ opacity: 0.6 }} /> {f.label} <KeyBadge keyOf={f.key_of!} />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {song.youtube_url && (
          <>
            <div style={{ borderTop: '1px solid var(--color-border)', margin: 'var(--space-md) 0' }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Reference</div>
            <a href={song.youtube_url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-neutral-50)', fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
              <div style={{ width: 20, height: 20, background: '#e33', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '8px solid white', marginLeft: 2 }} />
              </div>
              YouTube reference video
            </a>
          </>
        )}

        <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)' }}>
          <button style={{ fontSize: 12, color: 'var(--color-brand-500)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Plus size={13} /> Upload a file
          </button>
        </div>
      </div>

      {/* Usage card */}
      <div className="card">
        <div className="section-label" style={{ marginBottom: 'var(--space-md)' }}>Usage</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
          {[
            { value: song.usage.times_sung, label: 'Times sung' },
            { value: song.usage.times_planned, label: 'Planned' },
            { value: format(new Date(song.usage.last_sung), 'd MMM'), label: 'Last sung' },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center', padding: 'var(--space-md)', background: 'var(--color-neutral-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-brand-600)', letterSpacing: '-0.02em', marginBottom: 3 }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{stat.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Recent services</div>
        {song.recent_services.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < song.recent_services.length - 1 ? '1px solid var(--color-border)' : 'none', fontSize: 13 }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>{format(new Date(s.date), 'd MMMM yyyy')}</span>
            <KeyBadge keyOf={s.key_used} />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{s.service_time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
