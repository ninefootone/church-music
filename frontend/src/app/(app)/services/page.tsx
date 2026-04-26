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
      api.get('/api/services', { params: { upcoming: 'true' } }),
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

  const todayServices = upcoming.filter(s => isToday(s.service_date))
  const futureServices = upcoming.filter(s => !isToday(s.service_date))

  const ServiceCard = ({ service, badge }: { service: Service; badge: 'today' | 'upcoming' | 'past' }) => (
    <Link href={`/services/${service.id}`} className={`service-card ${badge === 'past' ? 'is-past' : ''}`}>
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
        <span className={`badge badge-${badge}`}>
          {badge === 'today' ? 'TODAY' : badge === 'upcoming' ? 'UPCOMING' : 'PAST'}
        </span>
        <ChevronRight size={18} style={{ color: 'var(--color-text-muted)' }} />
      </div>
    </Link>
  )

  const hasAny = upcoming.length > 0 || past.length > 0

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

      {!hasAny ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
          <p className="text-muted" style={{ marginBottom: 'var(--space-sm)' }}>No services yet.</p>
          {isAdmin && <Link href="/services/new" className="link">Plan your first service</Link>}
        </div>
      ) : (
        <>
          {/* Today */}
          {todayServices.length > 0 && (
            <>
              <div className="section-label">Today</div>
              {todayServices.map(s => <ServiceCard key={s.id} service={s} badge="today" />)}
            </>
          )}

          {/* Upcoming */}
          {futureServices.length > 0 ? (
            <>
              <div className="section-label" style={{ marginTop: todayServices.length > 0 ? 'var(--space-lg)' : 0 }}>Upcoming</div>
              {futureServices.map(s => <ServiceCard key={s.id} service={s} badge="upcoming" />)}
            </>
          ) : todayServices.length === 0 && (
            <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-md) var(--space-lg)' }}>
              <p className="text-muted">No upcoming services. {isAdmin && <Link href="/services/new" className="link">Add one</Link>}</p>
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 'var(--space-lg)' }}>Past</div>
              {past.map(s => <ServiceCard key={s.id} service={s} badge="past" />)}
            </>
          )}
        </>
      )}
    </div>
  )
}