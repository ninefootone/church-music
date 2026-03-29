'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { format, isFuture, isToday, parseISO } from 'date-fns'
import { Plus } from 'lucide-react'
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
    // Only fetch once church is loaded and available
    if (!church || fetchedRef.current) return
    fetchedRef.current = true
    Promise.all([
      api.get('/api/songs').then(r => setSongs(r.data.slice(0, 4))),
      api.get('/api/services').then(r => setServices(r.data.slice(0, 3))),
      api.get('/api/members').then(r => setMembers(r.data)),
    ]).finally(() => setLoading(false))
  }, [church])

  if (churchLoading || (loading && !songs.length)) return (
    <div className="loading-state">Loading…</div>
  )

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <span className="section-label">Songs</span>
            {isAdmin && <Link href="/songs/new" className="btn btn-ghost">Add new +</Link>}
          </div>
          {songs.length === 0 ? (
            <div className="text-hint">No songs yet. <Link href="/songs/new" className="link-brand">Add your first</Link></div>
          ) : songs.map((song, i) => (
            <Link key={song.id} href={`/songs/${song.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < songs.length - 1 ? '1px solid var(--color-border)' : 'none', textDecoration: 'none' }}>
              <div>
                <div className="item-title">{song.title}</div>
                <div className="item-meta" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <span className="section-label">Services</span>
            {isAdmin && <Link href="/services/new" className="btn btn-ghost">Add new +</Link>}
          </div>
          {services.length === 0 ? (
            <div className="text-hint">No services yet. <Link href="/services/new" className="link-brand">Add your first</Link></div>
          ) : services.map((service, i) => {
            const date = parseISO(service.service_date)
            const upcoming = isFuture(date) || isToday(date)
            return (
              <Link key={service.id} href={`/services/${service.id}`} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < services.length - 1 ? '1px solid var(--color-border)' : 'none', gap: 8, textDecoration: 'none' }}>
                <div>
                  <div className="item-title">
                    {format(date, 'd MMM')}{service.service_time ? ` · ${service.service_time}` : ''}
                  </div>
                  {service.title && <div className="item-meta">{service.title}</div>}
                </div>
                <span className={`badge ${upcoming ? 'badge-upcoming' : 'badge-past'}`}>{upcoming ? 'UPCOMING' : 'PAST'}</span>
              </Link>
            )
          })}
          <div style={{ marginTop: 'var(--space-md)' }}>
            <Link href="/services" className="btn btn-ghost">View all →</Link>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <span className="section-label">Team</span>
          {isAdmin && (
            <button className="btn btn-ghost" onClick={() => {
              if (church) {
                const msg = `Invite code for ${church.name}: ${church.invite_code}\n\nShare this link: ${window.location.origin}/onboarding`
                navigator.clipboard.writeText(church.invite_code)
                alert(`Invite code copied: ${church.invite_code}\n\nAsk them to visit ${window.location.origin} and choose "Join an existing church"`)
              }
            }}>Invite member +</button>
          )}
        </div>
        {members.map((member, i) => (
          <div key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < members.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <div className="member-avatar">
                {(member.name || member.email || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="item-title" style={{ marginBottom: 0 }}>{member.name || member.email}</div>
                <div className="item-meta" style={{ textTransform: 'capitalize' }}>{member.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
