'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Music } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import axios from 'axios'

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

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Halyard Display, sans-serif', color: '#8a95a0' }}>Loading…</div>
  if (error || !service) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Halyard Display, sans-serif', color: '#8a95a0' }}>Service not found.</div>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', fontFamily: 'Halyard Display, Helvetica Neue, sans-serif' }}>
      <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '14px var(--space-lg)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Music size={16} style={{ color: 'var(--color-brand-500)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>Church Music</span>
        </div>
      </div>
      <main style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--space-xl) var(--space-lg)' }}>
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.025em', marginBottom: 4 }}>
            {format(parseISO(service.service_date), 'd MMMM yyyy')}
          </h1>
          {service.service_time && <div style={{ fontSize: 15, color: 'var(--color-text-secondary)' }}>{service.service_time}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(service.items || []).map((item: any, i: number) => (
            <div key={item.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px var(--space-md)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', width: 18, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: item.type === 'song' ? 500 : 400, color: item.type === 'song' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                  {item.type === 'song' && item.song_title ? item.song_title : (item.title || item.type)}
                </div>
                {item.type === 'song' && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                    {(item.key_override || item.song_default_key) && (
                      <span style={{ background: 'var(--color-brand-50)', color: 'var(--color-brand-600)', border: '1px solid var(--color-brand-100)', padding: '1px 6px', borderRadius: '999px', fontWeight: 700, fontSize: 10 }}>
                        {item.key_override || item.song_default_key}
                      </span>
                    )}
                    {item.song_ccli_number && <span>CCLI {item.song_ccli_number}</span>}
                  </div>
                )}
              </div>
              {item.type === 'song' && item.song_youtube_url && (
                <a href={item.song_youtube_url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, width: 24, height: 24, background: '#e33', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                  <span style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '7px solid white', marginLeft: 2 }} />
                </a>
              )}
            </div>
          ))}
        </div>
      </main>
      <footer style={{ textAlign: 'center', padding: 'var(--space-xl)', fontSize: 11, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-xl)' }}>
        Church Music · View-only link
      </footer>
    </div>
  )
}
