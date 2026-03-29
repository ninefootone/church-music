'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Share2, Plus } from 'lucide-react'
import { useChurch } from '@/context/ChurchContext'
import { KeyBadge } from '@/components/ui/badges'
import api from '@/lib/api'

export default function ServiceDetailPage() {
  const { id } = useParams()
  const { isAdmin } = useChurch()
  const [service, setService] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!id) return
    api.get(`/api/services/${id}`)
      .then(r => setService(r.data))
      .catch(err => console.error('Failed to fetch service:', err))
      .finally(() => setLoading(false))
  }, [id])

  const copyShareLink = () => {
    if (!service) return
    const url = `${window.location.origin}/s/${service.public_token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="loading-state">Loading…</div>
  if (!service) return <div className="loading-state">Service not found.</div>

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Link href="/services" className="back-link">
        <ArrowLeft size={13} /> Back to services
      </Link>

      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 className="detail-title" style={{ fontSize: 24, marginBottom: 4 }}>
              {format(parseISO(service.service_date), 'd MMMM yyyy')}
              {service.service_time && <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}> · {service.service_time}</span>}
            </h1>
            {service.title && <div className="item-meta" style={{ fontSize: 15 }}>{service.title}</div>}
          </div>
          <button onClick={copyShareLink} className="btn btn-secondary" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Share2 size={14} /> {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <span className="section-label">Running order</span>
          {isAdmin && (
            <Link href={`/services/${id}/edit`} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Plus size={14} /> Edit order
            </Link>
          )}
        </div>

        {!service.items || service.items.length === 0 ? (
          <div className="empty-state">
            No items added yet.{isAdmin && <> <Link href={`/services/${id}/edit`} className="link-brand">Build the running order</Link></>}
          </div>
        ) : (
          service.items.map((item: any, i: number) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < service.items.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
              <div className="item-meta" style={{ width: 20, textAlign: 'center', flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div className="item-title">
                  {item.type === 'song' && item.song_title ? item.song_title : (item.title || item.type.charAt(0).toUpperCase() + item.type.slice(1))}
                </div>
                {item.type === 'song' && item.song_author && (
                  <div className="item-meta">{item.song_author}</div>
                )}
                {item.notes && <div className="item-meta" style={{ fontStyle: 'italic', marginTop: 2 }}>{item.notes}</div>}
              </div>
              {item.type === 'song' && (item.key_override || item.song_default_key) && (
                <KeyBadge keyOf={item.key_override || item.song_default_key} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
