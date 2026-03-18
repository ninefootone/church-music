'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, isFuture, isToday, parseISO } from 'date-fns'
import { Plus } from 'lucide-react'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'
import { Song, Service, Membership } from '@/types'

export default function DashboardPage() {
  const { church, loading: churchLoading, isAdmin } = useChurch()
  const [songs, setSongs] = useState<Song[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [members, setMembers] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!church) return
    Promise.all([
      api.get('/api/songs').then(r => setSongs(r.data.slice(0, 4))),
      api.get('/api/services').then(r => setServices(r.data.slice(0, 3))),
      api.get('/api/members').then(r => setMembers(r.data)),
    ]).finally(() => setLoading(false))
  }, [church])

  if (churchLoading || loading) return (
    <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-xl)' }}>Loading…</div>
  )

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>

        {/* Songs */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <span className="section-label">Songs</span>
            {isAdmin && <Link href="/songs/new" className="btn btn-ghost">Add new +</Link>}
          </div>
          {songs.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              No songs yet. <Link href="/songs/new" style={{ color: 'var(--color-brand-500)' }}>Add your first</Link>
            </div>
          ) : songs.map((song, i) => (
            <Link key={song.id} href={`/songs/${song.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < songs.length - 1 ? '1px solid var(--color-border)' : 'none', textDecoration: 'none' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 2 }}>{song.title}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{song.author}</span>
                  {song.default_key && <KeyBadge keyOf={song.default_key} />}
                </div>
              </div>
              {song.category && <CategoryBadge category={song.category} />}
            </Link>
          ))}
          <div style={{ marginTop: 'var(--space-md)' }}>
            <Link href="/songs" className="btn btn-ghost">View all songs →</Link>
          </div>
        </div>

        {/* Services */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <span className="section-label">Services</span>
            {isAdmin && <Link href="/services/new" className="btn btn-ghost">Add new +</Link>}
          </div>
          {services.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              No services yet. <Link href="/services/new" style={{ color: 'var(--color-brand-500)' }}>Add your first</Link>
            </div>
          ) : services.map((service, i) => {
            const date = parseISO(service.service_date)
            const upcoming = isFuture(date) || isToday(date)
            return (
              <Link key={service.id} href={`/services/${service.id}`} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < services.length - 1 ? '1px solid var(--color-border)' : 'none', gap: 8, textDecoration: 'none' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 2 }}>
                    {format(date, 'd MMM')} · {service.service_time || ''}
                  </div>
                </div>
                <span className={`badge ${upcoming ? 'badge-upcoming' : 'badge-past'}`}>
                  {upcoming ? 'UPCOMING' : 'PAST'}
                </span>
              </Link>
            )
          })}
          <div style={{ marginTop: 'var(--space-md)' }}>
            <Link href="/services" className="btn btn-ghost">View all →</Link>
          </div>
        </div>
      </div>

      {/* Team */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <span className="section-label">Team</span>
          {isAdmin && <button className="btn btn-ghost">Invite member +</button>}
        </div>
        {members.map((member, i) => (
          <div key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < members.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-brand-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--color-brand-700)', flexShrink: 0 }}>
                {(member.user?.name || member.user?.email || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>{member.user?.name || member.user?.email}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{member.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
