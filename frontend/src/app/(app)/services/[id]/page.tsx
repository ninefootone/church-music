'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Share2, Plus, Music, BookOpen, Mic2, ExternalLink, Trash2 } from 'lucide-react'
import { KeyBadge, CategoryBadge } from '@/components/ui/badges'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

const typeIcon = (type: string) => {
  if (type === 'song') return <Music size={14} />
  if (type === 'reading') return <BookOpen size={14} />
  if (type === 'sermon') return <Mic2 size={14} />
  return null
}

export default function ServiceDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { isAdmin, loading: churchLoading } = useChurch()
  const [service, setService] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showDeleteService, setShowDeleteService] = useState(false)
  
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
        <div className="service-detail-header">
          <div style={{ minWidth: 0 }}>
            <h1 className="service-detail-title">
              {format(parseISO(service.service_date), 'd MMMM yyyy')}
            </h1>
            {service.service_time && (
              <p style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-secondary)', marginTop: 2 }}>{service.service_time}</p>
            )}
            {service.title && (
              <p style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-muted)', marginTop: 2 }}>{service.title}</p>
            )}
          </div>
                    <div className="service-detail-actions">
            {/* Share — compact icon+label button */}
            <button
              onClick={copyShareLink}
              className="btn btn-secondary"
              style={{ padding: '7px 10px', fontSize: 'var(--text-xs)', gap: 4 }}
              title="Copy share link"
            >
              <Share2 size={14} />
              <span>{copied ? 'Copied!' : 'Share'}</span>
            </button>

            {/* Open public view */}
            <a
              href={'/s/' + service.public_token}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              <ExternalLink size={14} /> Public view
            </a>

            {/* Edit order — admin only */}
            {isAdmin && (
              <Link href={`/services/${id}/edit`} className="btn btn-primary btn-sm">
                <Plus size={14} /> Edit order
              </Link>
            )}
            {isAdmin && (
              <button
                onClick={() => setShowDeleteService(true)}
                className="btn btn-secondary btn-sm"
                style={{ color: '#9a3a3a' }}
              >
                <Trash2 size={14} /> Delete
              </button>
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
            <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 0', borderBottom: i < service.items.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', width: 24, textAlign: 'center', flexShrink: 0, paddingTop: 2 }}>{i + 1}</div>
              <div style={{ color: 'var(--color-text-muted)', flexShrink: 0, paddingTop: 3 }}>{typeIcon(item.type)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="dash-row-title">
                  {item.type === 'song' && item.song_title ? item.song_title : (item.title || item.type.charAt(0).toUpperCase() + item.type.slice(1))}
                </p>
                {item.type === 'song' && item.song_author && <p className="dash-row-meta">{item.song_author}</p>}
                {item.notes && <p className="dash-row-meta" style={{ fontStyle: 'italic', marginTop: 2 }}>{item.notes}</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {item.type === 'song' && (item.key_override || item.song_default_key) && (
                  <KeyBadge keyOf={item.key_override || item.song_default_key} />
                )}
                {item.type === 'song' && item.song_category && (
                  <CategoryBadge category={item.song_category} />
                )}
              </div>
            </div>
          ))
        )}
      </div>
{showDeleteService && (
        <ConfirmModal
          title="Delete service"
          message="Are you sure you want to delete this service? This cannot be undone."
          confirmLabel="Delete service"
          danger
          onConfirm={async () => {
            await api.delete(`/api/services/${id}`)
            router.push('/services')
          }}
          onCancel={() => setShowDeleteService(false)}
        />
      )}
    </div>
  )
}