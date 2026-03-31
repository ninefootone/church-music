'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Music, BookOpen, Mic2 } from 'lucide-react'
import axios from 'axios'

const typeIcon = (type: string) => {
  if (type === 'song') return <Music size={14} style={{ color: 'var(--color-text-muted)' }} />
  if (type === 'reading') return <BookOpen size={14} style={{ color: 'var(--color-text-muted)' }} />
  if (type === 'sermon') return <Mic2 size={14} style={{ color: 'var(--color-text-muted)' }} />
  return null
}

export default function PublicServicePage() {
  const { token } = useParams()
  const [service, setService] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/services/public/${token}`)
      .then(r => setService(r.data))
      .catch(() => setError('Service not found'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <p className="text-muted">Loading…</p>
    </div>
  )

  if (error || !service) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <p className="text-muted">Service not found.</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Nav */}
      <nav style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', padding: '0 var(--space-lg)', height: 58, display: 'flex', alignItems: 'center' }}>
        <div style={{ maxWidth: 'var(--width-app)', margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Music size={18} style={{ color: 'var(--color-brand-500)' }} />
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
            Song Stack
          </span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginLeft: 4 }}>
            · View-only
          </span>
        </div>
      </nav>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-xl) var(--space-lg)' }}>
        {/* Date / time header */}
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            {format(parseISO(service.service_date), 'd MMMM yyyy')}
          </h1>
          {service.service_time && (
            <p style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-secondary)' }}>{service.service_time}</p>
          )}
          {service.title && (
            <p style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-muted)', marginTop: 2 }}>{service.title}</p>
          )}
        </div>

        {/* Running order */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {(!service.items || service.items.length === 0) ? (
            <p className="text-muted" style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>No items in this service yet.</p>
          ) : service.items.map((item: any, i: number) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '14px var(--space-lg)',
                borderBottom: i < service.items.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              {/* Position */}
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', width: 24, textAlign: 'center', flexShrink: 0, paddingTop: 2 }}>
                {i + 1}
              </div>

              {/* Icon */}
              <div style={{ flexShrink: 0, paddingTop: 3 }}>{typeIcon(item.type)}</div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="dash-row-title">
                  {item.type === 'song' && item.song_title
                    ? item.song_title
                    : (item.title || item.type.charAt(0).toUpperCase() + item.type.slice(1))}
                </p>
                {item.type === 'song' && item.song_author && (
                  <p className="dash-row-meta">{item.song_author}</p>
                )}
                {item.notes && (
                  <p className="dash-row-meta" style={{ fontStyle: 'italic', marginTop: 2 }}>{item.notes}</p>
                )}
                {item.type === 'song' && item.song_ccli_number && (
                  <p className="dash-row-meta" style={{ marginTop: 2 }}>CCLI {item.song_ccli_number}</p>
                )}
              </div>

              {/* Key + YouTube */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {item.type === 'song' && (item.key_override || item.song_default_key) && (
                  <span className="badge-key">{item.key_override || item.song_default_key}</span>
                )}
                {item.type === 'song' && item.song_youtube_url && (
                  <a
                    href={item.song_youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ width: 28, height: 28, background: '#e33', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none' }}
                  >
                    <span style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '9px solid white', marginLeft: 2 }} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="app-footer">
        Song Stack &mdash; shared by your church
      </footer>
    </div>
  )
}
