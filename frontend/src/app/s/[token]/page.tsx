'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Music, BookOpen, Mic2, ChevronDown, ChevronUp, FileText, ExternalLink, PlayCircle } from 'lucide-react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL

const typeIcon = (type: string) => {
  if (type === 'song') return <Music size={15} style={{ color: 'var(--color-brand-500)', flexShrink: 0 }} />
  if (type === 'reading') return <BookOpen size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
  if (type === 'sermon') return <Mic2 size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
  return null
}

interface SongFile {
  id: string
  label: string
  file_type: string
  key_of: string | null
  url: string
}

function SongItem({ item, index }: { item: any; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const [files, setFiles] = useState<SongFile[] | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(false)

  const handleExpand = async () => {
    if (!expanded && item.song_id && files === null) {
      setLoadingFiles(true)
      try {
        const res = await axios.get(`${API}/api/uploads/public/songs/${item.song_id}/files`)
        setFiles(res.data)
      } catch (err) {
        setFiles([])
      } finally {
        setLoadingFiles(false)
      }
    }
    setExpanded(!expanded)
  }

  const isSong = item.type === 'song'

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 8 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px var(--space-md)', cursor: isSong ? 'pointer' : 'default' }}
        onClick={isSong ? handleExpand : undefined}
      >
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', width: 24, textAlign: 'center', flexShrink: 0 }}>
          {index + 1}
        </span>

        {typeIcon(item.type)}

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 'var(--text-md)', fontWeight: isSong ? 600 : 400, color: isSong ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 0 }}>
            {isSong && item.song_title ? item.song_title : (item.title || item.type)}
          </p>
          {item.notes && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: 2 }}>{item.notes}</p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isSong && (item.key_override || item.song_default_key) && (
            <span className="badge-key">{(item.key_override || item.song_default_key || '').replace(/♯/g, '#').replace(/♭/g, 'b')}</span>
          )}
          {isSong && item.song_youtube_url && (
            <a
              href={item.song_youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ width: 28, height: 28, background: '#e33', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}
            >
              <span style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '9px solid white', marginLeft: 2 }} />
            </a>
          )}
          {isSong && (
            <span style={{ color: 'var(--color-text-muted)', display: 'flex' }}>
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          )}
        </div>
      </div>

      {isSong && expanded && (
        <div style={{ borderTop: '1px solid var(--color-border)', padding: 'var(--space-md)', background: 'var(--color-neutral-50)' }}>
          {loadingFiles ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Loading files...</p>
          ) : files && files.length > 0 ? (
            <div>
              <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 10 }}>Sheet music</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {files.map(file => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-brand-600)', textDecoration: 'none', transition: 'all var(--transition-fast)' }}
                  >
                    <FileText size={14} />
                    {file.label}
                    {file.key_of && (
                      <span className="badge-key" style={{ marginLeft: 2 }}>{file.key_of.replace(/♯/g, '#').replace(/♭/g, 'b')}</span>
                    )}
                    <ExternalLink size={12} style={{ opacity: 0.5 }} />
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No sheet music uploaded for this song yet.
            </p>
          )}

          {(item.custom_arrangement || item.song_suggested_arrangement) && (() => {
            const raw = item.custom_arrangement || item.song_suggested_arrangement
            try {
              const parts: string[] = JSON.parse(raw)
              if (Array.isArray(parts)) return (
                <div style={{ marginTop: 10 }}>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 6 }}>Arrangement</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {parts.map((label: string, i: number) => (
                      <span key={i} className="arrangement-pill arrangement-pill-sm">{label}</span>
                    ))}
                  </div>
                </div>
              )
            } catch {}
            return (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 10 }}>
                {raw}
              </p>
            )
          })()}
          {item.song_ccli_number && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 10 }}>
              CCLI {item.song_ccli_number}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function PublicServicePage() {
  const { token } = useParams()
  const [service, setService] = useState<any>(null)
  const [musicians, setMusicians] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    axios.get(`${API}/api/services/public/${token}`)
      .then(r => {
        setService(r.data)
        return axios.get(`${API}/api/services/${r.data.id}/musicians`)
      })
      .then(r => setMusicians(r.data))
      .catch((err) => {
        if (!service) setError('Service not found')
      })
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <p className="text-muted">Loading...</p>
    </div>
  )

  if (error || !service) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <p className="text-muted">Service not found.</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <nav style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', padding: '0 var(--space-lg)', height: 58, display: 'flex', alignItems: 'center' }}>
        <div style={{ maxWidth: 'var(--width-app)', margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.svg" alt="Song Stack" style={{ height: 22, borderRadius: 4 }} />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginLeft: 4 }}>View only</span>
        </div>
      </nav>

      <main style={{ maxWidth: 'var(--width-app)', margin: '0 auto', padding: 'var(--space-xl) var(--space-lg)' }}>
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
          <div style={{ marginTop: 'var(--space-md)' }}>
            <a href={`/s/${token}/set`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--color-brand-600)', color: 'white', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', fontWeight: 600, textDecoration: 'none' }}>
              <PlayCircle size={15} />
              Set mode
            </a>
          </div>
        </div>

        {musicians.length > 0 && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
            {Object.values(
              musicians.reduce((acc: any, m: any) => {
                const key = m.user_id || m.name
                if (!acc[key]) acc[key] = { name: m.name, roles: [] }
                acc[key].roles.push(m.role)
                return acc
              }, {})
            ).map((g: any) => `${g.name} (${g.roles.join(', ')})`).join(' · ')}
          </p>
        )}

        {(!service.items || service.items.length === 0) ? (
          <p className="text-muted">No items in this service yet.</p>
        ) : (
          <>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
              Tap a song to view sheet music
            </p>
            {service.items.map((item: any, i: number) => (
              <SongItem key={i} item={item} index={i} />
            ))}
          </>
        )}
      </main>

      <footer className="app-footer">
        Song Stack &mdash; shared by your church
      </footer>
    </div>
  )
}
