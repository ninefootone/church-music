'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { format, isFuture, isToday, parseISO } from 'date-fns'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'

export default function DashboardPage() {
  const { church, loading: churchLoading, isAdmin } = useChurch()
  const [songs, setSongs] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!church || fetchedRef.current) return
    fetchedRef.current = true
    Promise.all([
      api.get('/api/songs').then(r => setSongs(r.data.slice(0, 4))),
      api.get('/api/services').then(r => setServices(r.data.slice(0, 3))),
      api.get('/api/members').then(r => setMembers(r.data)),
    ]).finally(() => setLoading(false))
  }, [church])

  const handleInvite = () => {
    if (!church) return
    navigator.clipboard.writeText(church.invite_code)
    alert(`Invite code copied: ${church.invite_code}\n\nAsk them to visit app.songstack.church and choose "Join an existing church"`)
  }

  if (churchLoading || (loading && !songs.length)) return (
    <p className="text-muted" style={{ padding: 'var(--space-xl)' }}>Loading…</p>
  )

  return (
    <div>
      {/* 60/40 grid — collapses to single column on mobile */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <span className="section-label">Songs</span>
            {isAdmin && <Link href="/songs/new" className="btn btn-ghost">Add new +</Link>}
          </div>
          {songs.length === 0 ? (
            <p className="text-muted">No songs yet. <Link href="/songs/new" className="link">Add your first</Link></p>
          ) : songs.map((song, i) => (
            <Link key={song.id} href={`/songs/${song.id}`} className="dash-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="dash-row-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</p>
                <p className="dash-row-meta">
                  <span>{song.author}</span>
                  {song.default_key && <KeyBadge keyOf={song.default_key} />}
                </p>
              </div>
              {song.category && <CategoryBadge category={song.category} />}
            </Link>
          ))}
          <div style={{ marginTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-sm)' }}>
            <Link href="/songs" className="btn btn-ghost">View all songs →</Link>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <span className="section-label">Services</span>
            {isAdmin && <Link href="/services/new" className="btn btn-ghost">Add new +</Link>}
          </div>
          {services.length === 0 ? (
            <p className="text-muted">No services yet. <Link href="/services/new" className="link">Add your first</Link></p>
          ) : services.map((service, i) => {
            const date = parseISO(service.service_date)
            const upcoming = isFuture(date) || isToday(date)
            return (
              <Link key={service.id} href={`/services/${service.id}`} className="dash-row">
                <div style={{ flex: 1 }}>
                  <p className="dash-row-title">{format(date, 'd MMM')}{service.service_time ? ` · ${service.service_time}` : ''}</p>
                  {service.title && <p className="dash-row-meta">{service.title}</p>}
                </div>
                <span className={`badge ${upcoming ? 'badge-upcoming' : 'badge-past'}`}>
                  {upcoming ? 'UPCOMING' : 'PAST'}
                </span>
              </Link>
            )
          })}
          <div style={{ marginTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-sm)' }}>
            <Link href="/services" className="btn btn-ghost">View all →</Link>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <span className="section-label">Team</span>
          {isAdmin && <button onClick={handleInvite} className="btn btn-ghost">Invite member +</button>}
        </div>
        {members.map((member, i) => (
          <div key={member.id} className="member-row">
            <div className="member-avatar">
              {(member.name || member.email || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="member-name">{member.name || member.email}</p>
              <p className="member-role">{member.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
