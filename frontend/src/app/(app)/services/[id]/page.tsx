'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Share2, Plus, Music, BookOpen, Mic2 } from 'lucide-react'
import { KeyBadge, CategoryBadge } from '@/components/ui/badges'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'

const typeIcon = (type: string) => {
  if (type === 'song') return <Music size={14} />
  if (type === 'reading') return <BookOpen size={14} />
  if (type === 'sermon') return <Mic2 size={14} />
  return null
}

export default function ServiceDetailPage() {
  const { id } = useParams()
  const { isAdmin, loading: churchLoading } = useChurch()
  const [service, setService] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!id || churchLoading) return
    setLoading(true)
    api.get(`/api/services/${id}`)
      .then(r => setService(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id, churchLoading])

  const copyShareLink = () => {
    if (!service) return
    navigator.clipboard.writeText(`${window.location.origin}/s/${service.public_token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading || churchLoading) return <p className="text-muted" style={{ padding: 'var(--space-xl)' }}>Loading…</p>
  if (notFound || !service) return (
    <div style={{ padding: 'var(--space-xl)' }}>
      <p className="text-muted" style={{ marginBottom: 'var(--space-md)' }}>Service not found.</p>
      <Link href="/services" className="back-link"><ArrowLeft size={14} /> Back to services</Link>
    </div>
  )

  return (
    <div>
      <Link href="/services" className="back-link"><ArrowLeft size={14} /> Back to services</Link>

      {/* Header */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>
              {format(parseISO(service.service_date), 'd MMMM yyyy')}
              {service.service_time && (
                <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}> · {service.service_time}</span>
              )}
            </h1>
            {service.title && <p style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-secondary)' }}>{service.title}</p>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={copyShareLink} className="btn btn-secondary btn-sm">
              <Share2 size={14} /> {copied ? 'Copied!' : 'Share'}
            </button>
            {isAdmin && (
              <Link href={`/services/${id}/edit`} className="btn btn-primary btn-sm">
                <Plus size={14} /> Edit order
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Running order */}
      <div className="card">
        <div className="section-label">Running order</div>

        {!service.items || service.items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
            <p className="text-muted" style={{ marginBottom: 'var(--space-sm)' }}>No items added yet.</p>
            {isAdmin && (
              <Link href={`/services/${id}/edit`} className="btn btn-primary btn-sm">
                <Plus size={14} /> Build the running order
              </Link>
            )}
          </div>
        ) : (
          service.items.map((item: any, i: number) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '12px 0',
                borderBottom: i < service.items.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              {/* Position */}
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', width: 24, textAlign: 'center', flexShrink: 0, paddingTop: 2 }}>
                {i + 1}
              </div>

              {/* Icon */}
              <div style={{ color: 'var(--color-text-muted)', flexShrink: 0, paddingTop: 3 }}>
                {typeIcon(item.type)}
              </div>

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
              </div>

              {/* Key badge */}
              {item.type === 'song' && (item.key_override || item.song_default_key) && (
                <KeyBadge keyOf={item.key_override || item.song_default_key} />
              )}

              {/* Category badge */}
              {item.type === 'song' && item.song_category && (
                <CategoryBadge category={item.song_category} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
