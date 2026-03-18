'use client'

import Link from 'next/link'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
import { format } from 'date-fns'

// Placeholder data — replace with real API calls
const recentSongs = [
  { id: '1', title: '10,000 Reasons (Bless The Lord)', author: 'Jonas Myrin, Matt Redman', default_key: 'E', category: 'praise' as const, last_sung: '2026-03-01' },
  { id: '2', title: 'In Christ Alone', author: 'Keith Getty, Stuart Townend', default_key: 'G', category: 'assurance' as const, last_sung: '2026-02-15' },
  { id: '3', title: 'How Great Is Your Faithfulness', author: 'Thomas Chisholm', default_key: 'D', category: 'praise' as const, last_sung: '2026-03-08' },
  { id: '4', title: 'Yet Not I But Through Christ In Me', author: 'CityAlight', default_key: 'A', category: 'response' as const, last_sung: '2026-03-01' },
]

const upcomingServices = [
  { id: '1', service_date: '2026-03-22', service_time: '9.15am', preview: 'Welcome · 10,000 Reasons · Confession…', upcoming: true },
  { id: '2', service_date: '2026-03-29', service_time: '9.15am', preview: '3 songs planned', upcoming: true },
  { id: '3', service_date: '2026-03-15', service_time: '9.15am', preview: '5 songs', upcoming: false },
]

const members = [
  { id: '1', name: 'James Barrett', role: 'Admin', initials: 'JB' },
  { id: '2', name: 'Sarah Reynolds', role: 'Member', initials: 'SR' },
  { id: '3', name: 'David Mills', role: 'Member', initials: 'DM' },
]

export default function DashboardPage() {
  return (
    <div>
      {/* 60/40 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>

        {/* Songs card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <span className="section-label">Songs</span>
            <Link href="/songs/new" className="btn-ghost btn">Add new +</Link>
          </div>

          {recentSongs.map((song, i) => (
            <Link
              key={song.id}
              href={`/songs/${song.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 0',
                borderBottom: i < recentSongs.length - 1 ? '1px solid var(--color-border)' : 'none',
                textDecoration: 'none',
                transition: 'opacity var(--transition-fast)',
              }}
              className="group"
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 2 }}>
                  {song.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{song.author}</span>
                  <KeyBadge keyOf={song.default_key} />
                  <span>Last sung {format(new Date(song.last_sung), 'd MMM yyyy')}</span>
                </div>
              </div>
              <CategoryBadge category={song.category} />
            </Link>
          ))}

          <div style={{ marginTop: 'var(--space-md)' }}>
            <Link href="/songs" className="btn btn-ghost">View all songs →</Link>
          </div>
        </div>

        {/* Services card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <span className="section-label">Services</span>
            <Link href="/services/new" className="btn btn-ghost">Add new +</Link>
          </div>

          {upcomingServices.map((service, i) => (
            <Link
              key={service.id}
              href={`/services/${service.id}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '9px 0',
                borderBottom: i < upcomingServices.length - 1 ? '1px solid var(--color-border)' : 'none',
                gap: 8,
                textDecoration: 'none',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 2 }}>
                  {format(new Date(service.service_date), 'd MMM')} · {service.service_time}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{service.preview}</div>
              </div>
              <span className={`badge ${service.upcoming ? 'badge-upcoming' : 'badge-past'}`}>
                {service.upcoming ? 'UPCOMING' : 'PAST'}
              </span>
            </Link>
          ))}

          <div style={{ marginTop: 'var(--space-md)' }}>
            <Link href="/services" className="btn btn-ghost">View all services →</Link>
          </div>
        </div>
      </div>

      {/* Team card */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <span className="section-label">Team</span>
          <button className="btn btn-ghost">Invite member +</button>
        </div>

        {members.map((member, i) => (
          <div
            key={member.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 0',
              borderBottom: i < members.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <div style={{
                width: 28, height: 28,
                borderRadius: '50%',
                background: 'var(--color-brand-100)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: 'var(--color-brand-700)',
                flexShrink: 0,
              }}>
                {member.initials}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>{member.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{member.role}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--color-brand-500)' }}>
              <button className="btn btn-ghost" style={{ fontSize: 11 }}>view</button>
              <span style={{ color: 'var(--color-border)' }}>|</span>
              <button className="btn btn-ghost" style={{ fontSize: 11 }}>edit</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
