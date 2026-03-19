'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Plus, Share2, Music, GripVertical, X } from 'lucide-react'
import { useChurch } from '@/context/ChurchContext'
import { KeyBadge } from '@/components/ui/badges'
import api from '@/lib/api'
import { Service } from '@/types'

const ITEM_TYPES = ['welcome', 'song', 'prayer', 'confession', 'assurance', 'reading', 'sermon', 'announcement', 'other']

export default function ServiceDetailPage() {
  const { id } = useParams()
  const { isAdmin } = useChurch()
  const [service, setService] = useState<Service | null>(null)
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

  if (loading) return <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-xl)' }}>Loading…</div>
  if (!service) return <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-xl)' }}>Service not found.</div>

  const date = parseISO(service.service_date)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Link href="/services" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: 'var(--space-lg)' }}>
        <ArrowLeft size={13} /> Back to services
      </Link>

      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>
              {format(date, 'd MMMM yyyy')}
              {service.service_time && <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}> · {service.service_time}</span>}
            </h1>
            {service.title && <div style={{ fontSize: 15, color: 'var(--color-text-secondary)' }}>{service.title}</div>}
          </div>
          <button onClick={copyShareLink} className="btn btn-secondary" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Share2 size={14} /> {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </div>

      {/* Service items */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <span className="section-label">Running order</span>
          {isAdmin && (
            <Link href={`/services/${service.id}/edit`} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Plus size={14} /> Edit order
            </Link>
          )}
        </div>

        {!service.items || service.items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)', fontSize: 14 }}>
            No items added yet.{isAdmin && <> <Link href={`/services/${service.id}/edit`} style={{ color: 'var(--color-brand-500)' }}>Build the running order</Link></>}
          </div>
        ) : (
          service.items.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < service.items!.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', width: 20, textAlign: 'center', flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  {item.type === 'song' && item.song ? item.song.title : (item.title || item.type.charAt(0).toUpperCase() + item.type.slice(1))}
                </div>
                {item.type === 'song' && item.song && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{item.song.author}</div>
                )}
                {item.notes && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: 2 }}>{item.notes}</div>}
              </div>
              {item.type === 'song' && (item.key_override || item.song?.default_key) && (
                <KeyBadge keyOf={item.key_override || item.song!.default_key} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
