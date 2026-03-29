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

  if (loading) return <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-xl)' }}>Loading…</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Services</h1>
        {isAdmin && <Link href="/services/new" className="btn btn-primary"><Plus size={16} /> Add new service</Link>}
      </div>

      {services.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>
          No services yet.{isAdmin && <> <Link href="/services/new" style={{ color: 'var(--color-brand-500)' }}>Plan your first service</Link></>}
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <div className="section-label">Upcoming</div>
              {upcoming.map(s => (
                <Link key={s.id} href={`/services/${s.id}`} className="service-card">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="service-date">
                      {format(parseISO(s.service_date), 'd MMMM yyyy')}{s.service_time ? ` · ${s.service_time}` : ''}
                    </div>
                    {s.title && <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{s.title}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span className="badge badge-upcoming">UPCOMING</span>
                    <ChevronRight size={18} style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                </Link>
              ))}
            </>
          )}
          {past.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 'var(--space-lg)' }}>Past</div>
              {past.map(s => (
                <Link key={s.id} href={`/services/${s.id}`} className="service-card is-past">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="service-date">
                      {format(parseISO(s.service_date), 'd MMMM yyyy')}{s.service_time ? ` · ${s.service_time}` : ''}
                    </div>
                    {s.title && <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{s.title}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span className="badge badge-past">PAST</span>
                    <ChevronRight size={18} style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                </Link>
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}
