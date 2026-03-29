'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, isFuture, isToday, parseISO } from 'date-fns'
import { Plus, ChevronRight } from 'lucide-react'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'

interface Service {
  id: string
  service_date: string
  service_time: string | null
  title: string | null
  public_token: string
}

export default function ServicesPage() {
  const { church, isAdmin } = useChurch()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!church) return
    api.get('/api/services')
      .then(r => setServices(r.data))
      .catch(err => console.error('Failed to fetch services:', err))
      .finally(() => setLoading(false))
  }, [church])

  const upcoming = services.filter(s => isFuture(parseISO(s.service_date)) || isToday(parseISO(s.service_date)))
  const past = services.filter(s => !isFuture(parseISO(s.service_date)) && !isToday(parseISO(s.service_date)))

  if (loading) return <div className="loading-state">Loading…</div>

  const ServiceCard = ({ service, isPast }: { service: Service; isPast?: boolean }) => (
    <Link href={`/services/${service.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-md) var(--space-lg)', marginBottom: 'var(--space-sm)', textDecoration: 'none', opacity: isPast ? 0.65 : 1, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="item-title" style={{ fontSize: 15, letterSpacing: '-0.01em' }}>
          {format(parseISO(service.service_date), 'd MMMM yyyy')}{service.service_time ? ` · ${service.service_time}` : ''}
        </div>
        {service.title && <div className="item-meta">{service.title}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span className={`badge ${isPast ? 'badge-past' : 'badge-upcoming'}`}>{isPast ? 'PAST' : 'UPCOMING'}</span>
        <ChevronRight size={16} style={{ color: 'var(--color-text-muted)' }} />
      </div>
    </Link>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
        <h1 className="page-title">Services</h1>
        {isAdmin && <Link href="/services/new" className="btn btn-primary"><Plus size={15} /> Add new service</Link>}
      </div>
      {services.length === 0 ? (
        <div className="card empty-state">
          No services yet.{isAdmin && <> <Link href="/services/new" className="link-brand">Plan your first service</Link></>}
        </div>
      ) : (
        <>
          {upcoming.length > 0 && <><div className="section-label">Upcoming</div>{upcoming.map(s => <ServiceCard key={s.id} service={s} />)}</>}
          {past.length > 0 && <><div className="section-label" style={{ marginTop: 'var(--space-lg)' }}>Past</div>{past.map(s => <ServiceCard key={s.id} service={s} isPast />)}</>}
        </>
      )}
    </div>
  )
}
