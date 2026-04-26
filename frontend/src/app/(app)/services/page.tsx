'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
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
  const { church, loading: churchLoading, isAdmin } = useChurch()
  const [upcoming, setUpcoming] = useState<Service[]>([])
  const [past, setPast] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!church || churchLoading) return
    Promise.all([
      // Upcoming: ASC so next service is first
      api.get('/api/services', { params: { upcoming: 'true' } }),
      // Past: DESC so most recent past service is first
      api.get('/api/services', { params: { upcoming: 'false' } }),
    ]).then(([upRes, pastRes]) => {
      setUpcoming(upRes.data)
      setPast(pastRes.data)
    }).catch(err => console.error('Failed to fetch services:', err))
      .finally(() => setLoading(false))
  }, [church, churchLoading])

  if (loading || churchLoading) return (
    <p className="text-muted" style={{ padding: 'var(--space-xl)' }}>Loading…</p>
  )

  const isToday = (dateStr: string) => {
    const today = new Date()
    const d = parseISO(dateStr)
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  }

  const ServiceCard = ({ service, isPast }: { service: Service; isPast?: boolean }) => (    <Link href={`/services/${service.id}`} className={`service-card ${isPast ? 'is-past' : ''}`}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="service-date">
          {format(parseISO(service.service_date), 'd MMMM yyyy')}
          {service.service_time && (
            <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}> · {service.service_time}</span>
          )}
        </p>
        {service.title && <p className="dash-row-meta">{service.title}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span className={`badge ${isPast ? 'badge-past' : isToday(service.service_date) ? 'badge-today' : 'badge-upcoming'}`}>
          {isPast ? 'PAST' : isToday(service.service_date) ? 'TODAY' : 'UPCOMING'}
        </span>
        <ChevronRight size={18} style={{ color: 'var(--color-text-muted)' }} />
      </div>
    </Link>
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Services</h1>
        {church && (
          <Link href="/services/new" className="btn btn-primary">
            <Plus size={16} /> Add new service
          </Link>
        )}
      </div>

      {upcoming.length === 0 && past.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
          <p className="text-muted" style={{ marginBottom: 'var(--space-sm)' }}>No services yet.</p>
          {isAdmin && <Link href="/services/new" className="link">Plan your first service</Link>}
        </div>
      ) : (
        <>
          {/* Upcoming — next service first */}
          {upcoming.length > 0 ? (
            <>
              <div className="section-label">Upcoming</div>
              {upcoming.map(s => <ServiceCard key={s.id} service={s} />)}
            </>
          ) : (
            <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-md) var(--space-lg)' }}>
              <p className="text-muted">No upcoming services. {isAdmin && <Link href="/services/new" className="link">Add one</Link>}</p>
            </div>
          )}

          {/* Past — most recent first */}
          {past.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 'var(--space-lg)' }}>Past</div>
              {past.map(s => <ServiceCard key={s.id} service={s} isPast />)}
            </>
          )}
        </>
      )}
    </div>
  )
}
