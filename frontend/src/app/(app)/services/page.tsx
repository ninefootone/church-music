'use client'

import Link from 'next/link'
import { format, isFuture, parseISO } from 'date-fns'
import { Plus, ChevronRight } from 'lucide-react'

const services = [
  { id: '1', service_date: '2026-03-22', service_time: '9.15am', preview: 'Welcome · 10,000 Reasons · In Christ Alone · Confession · Yet Not I…' },
  { id: '2', service_date: '2026-03-29', service_time: '9.15am', preview: '3 songs planned' },
  { id: '3', service_date: '2026-04-05', service_time: '9.15am', preview: 'Easter Sunday — not yet planned' },
  { id: '4', service_date: '2026-03-15', service_time: '9.15am', preview: 'How Great Is Your Faithfulness · Yet Not I · O Praise The Name · 10,000 Reasons' },
  { id: '5', service_date: '2026-03-08', service_time: '9.15am', preview: 'In Christ Alone · How Great Is Your Faithfulness · Be Thou My Vision · Cornerstone' },
  { id: '6', service_date: '2026-03-01', service_time: '9.15am', preview: '10,000 Reasons · Come Thou Fount · Before The Throne · Great Is Thy Faithfulness' },
]

export default function ServicesPage() {
  const upcoming = services.filter(s => isFuture(parseISO(s.service_date)))
  const past = services.filter(s => !isFuture(parseISO(s.service_date)))

  const ServiceCard = ({ service, isPast }: { service: typeof services[0], isPast: boolean }) => (
    <Link
      href={`/services/${service.id}`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: '14px', padding: '16px 20px', marginBottom: 10,
        textDecoration: 'none', gap: '16px',
        opacity: isPast ? 0.7 : 1,
        boxShadow: 'var(--shadow-sm)',
        transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.01em', marginBottom: 3 }}>
          {format(parseISO(service.service_date), 'd MMMM yyyy')} · {service.service_time}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {service.preview}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span className={`badge ${isPast ? 'badge-past' : 'badge-upcoming'}`}>
          {isPast ? 'PAST' : 'UPCOMING'}
        </span>
        <ChevronRight size={16} style={{ color: 'var(--color-text-muted)' }} />
      </div>
    </Link>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 className="page-title">Services</h1>
        <Link href="/services/new" className="btn btn-primary">
          <Plus size={15} /> Add new service
        </Link>
      </div>

      <div className="section-label" style={{ marginBottom: 10 }}>Upcoming</div>
      {upcoming.length === 0
        ? <div style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: '24px' }}>No upcoming services planned.</div>
        : upcoming.map(s => <ServiceCard key={s.id} service={s} isPast={false} />)
      }

      <div className="section-label" style={{ margin: '24px 0 10px' }}>Past</div>
      {past.map(s => <ServiceCard key={s.id} service={s} isPast={true} />)}

      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        <button className="btn btn-ghost">View full archive →</button>
      </div>
    </div>
  )
}
