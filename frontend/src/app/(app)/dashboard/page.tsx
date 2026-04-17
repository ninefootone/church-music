'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'
import { InviteMemberModal } from '@/components/ui/InviteMemberModal'

export default function DashboardPage() {
  const { church, loading: churchLoading, isAdmin } = useChurch()
  const [songs, setSongs] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  
  useEffect(() => {
    if (!church || fetchedRef.current) return
    fetchedRef.current = true
    Promise.all([
      api.get('/api/songs').then(r => setSongs(r.data.slice(0, 4))),
      // Only fetch upcoming services, ascending so next service is first
      api.get('/api/services', { params: { upcoming: 'true' } }).then(r => setServices(r.data.slice(0, 3))),
      api.get('/api/members').then(r => setMembers(r.data)),
    ]).finally(() => setLoading(false))
  }, [church])

  if (churchLoading || (loading && !songs.length)) return (
    <p className="text-muted" style={{ padding: 'var(--space-xl)' }}>Loading…</p>
  )

  return (
    <div>
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>

        {/* Songs */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <span className="section-label" style={{ marginBottom: 0 }}>Songs</span>
            {isAdmin && <Link href="/songs/new" className="btn btn-ghost">Add new +</Link>}
          </div>
          {songs.length === 0 ? (
            <p className="text-muted">No songs yet.{isAdmin && <> <Link href="/songs/new" className="link">Add your first</Link></>}</p>
          ) : songs.map((song, i) => (
            <Link key={song.id} href={`/songs/${song.id}`} className="dash-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="dash-row-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
                  {song.first_line && (
                    <span className="dash-row-meta" style={{ fontStyle: 'italic' , lineHeight: '1.4em' }}>{song.first_line}</span>
                  )}
                  <div style={{ display: 'flex', columnGap: 20 , rowGap: 0 , flexWrap: 'wrap' }}>
                    {song.last_sung && (
                      <span className="dash-row-meta" style={{ fontWeight: 400, fontSize: 'var(--text-xs)' }}>
                        <strong style={{ fontWeight: 600 }}>Last sung</strong>{' '}{format(parseISO(song.last_sung as string), 'd MMM yyyy')}
                      </span>
                    )}
                    {song.next_planned && (
                      <span className="dash-row-meta" style={{ fontWeight: 400, fontSize: 'var(--text-xs)' }}>
                        <strong style={{ fontWeight: 600 }}>Planned</strong>{' '}{format(parseISO(song.next_planned as string), 'd MMM yyyy')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {song.category && <CategoryBadge category={song.category} />}
            </Link>
          ))}
          <div style={{ marginTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-sm)' }}>
            <Link href="/songs" className="btn btn-ghost">View all songs →</Link>
          </div>
        </div>

        {/* Services — upcoming only */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <span className="section-label" style={{ marginBottom: 0 }}>Upcoming services</span>
            {church && <Link href="/services/new" className="btn btn-ghost">Add new +</Link>}
          </div>
          {services.length === 0 ? (
            <p className="text-muted">No upcoming services. <Link href="/services/new" className="link">Plan one</Link></p>
          ) : services.map((service) => {
            const date = parseISO(service.service_date)
            return (
              <Link key={service.id} href={`/services/${service.id}`} className="dash-row">
                <div style={{ flex: 1 }}>
                  <p className="dash-row-title">
                    {format(date, 'd MMM')}{service.service_time ? ` · ${service.service_time}` : ''}
                  </p>
                  {service.title && <p className="dash-row-meta">{service.title}</p>}
                </div>
                <span className="badge badge-upcoming">UPCOMING</span>
              </Link>
            )
          })}
          <div style={{ marginTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-sm)' }}>
            <Link href="/services" className="btn btn-ghost">View all →</Link>
          </div>
        </div>
      </div>

      {/* Team */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <span className="section-label" style={{ marginBottom: 0 }}>Team</span>
          {isAdmin && (
            <button onClick={() => setShowInviteModal(true)} className="btn btn-ghost">
              Invite member +
            </button>
          )}
        </div>
        {members.map((member) => (
          <div key={member.id} className="member-row">
            <div className="member-avatar">
              {(member.name || member.email || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="member-name">{member.name || member.email}</p>
              {member.name && member.email && (
                <p className="member-role">{member.email}</p>
              )}
            </div>
            {isAdmin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select
                  value={member.role}
                  onChange={async (e) => {
                    try {
                      await api.put(`/api/members/${member.id}/role`, { role: e.target.value })
                      setMembers(prev => prev.map(m =>
                        m.id === member.id ? { ...m, role: e.target.value } : m
                      ))
                    } catch (err: any) {
                      alert(err.response?.data?.error || 'Failed to update role')
                    }
                  }}
                  style={{ padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 'var(--text-sm)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  onClick={async () => {
                    if (!confirm(`Remove ${member.name || member.email} from ${church?.name}?`)) return
                    try {
                      await api.delete(`/api/churches/${church?.id}/members/${member.id}`)
                      setMembers(prev => prev.filter(m => m.id !== member.id))
                    } catch (err: any) {
                      alert(err.response?.data?.error || 'Failed to remove member')
                    }
                  }}
                  style={{ padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', background: 'var(--color-surface)', color: 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <p className="member-role" style={{ textTransform: 'capitalize' }}>{member.role}</p>
            )}
          </div>
        ))}
        {showInviteModal && church && (
          <InviteMemberModal
            church={church}
            onClose={() => setShowInviteModal(false)}
          />
        )}
      </div> 
    </div>
  )
}
