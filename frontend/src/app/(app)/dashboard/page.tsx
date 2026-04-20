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
  const [manageMember, setManageMember] = useState<any>(null)
  
  useEffect(() => {
    if (!church || fetchedRef.current) return
    fetchedRef.current = true
    Promise.all([
      api.get('/api/songs').then(r => setSongs(r.data.slice(0, 4))),
      // Only fetch upcoming services, ascending so next service is first
      api.get('/api/services', { params: { upcoming: 'true' } }).then(r => setServices(r.data.slice(0, 4))),
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

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          {members.map((member) => (
            <div
              key={member.id}
              onClick={() => isAdmin && setManageMember(member)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                width: 80,
                cursor: isAdmin ? 'pointer' : 'default',
              }}
            >
              <div style={{ position: 'relative' }}>
                {member.image_url ? (
                  <img
                    src={member.image_url}
                    alt={member.name || member.email}
                    style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'var(--color-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, fontWeight: 600, color: 'var(--color-text-secondary)',
                  }}>
                    {(member.name || member.email || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                {member.role === 'admin' && (
                  <span style={{
                    position: 'absolute', bottom: -2, right: -2,
                    background: 'var(--color-primary, #6366f1)',
                    color: '#fff', fontSize: 9, fontWeight: 700,
                    padding: '1px 4px', borderRadius: 4, letterSpacing: '0.03em',
                    lineHeight: '14px',
                  }}>A</span>
                )}
              </div>
              <p style={{
                fontSize: 'var(--text-xs)', textAlign: 'center', lineHeight: '1.3',
                color: 'var(--color-text)', margin: 0,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                width: '100%',
              }}>
                {member.name || member.email}
              </p>
              {isAdmin && member.email && (
                <p style={{
                  fontSize: 10, textAlign: 'center', lineHeight: '1.2',
                  color: 'var(--color-text-muted)', margin: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  width: '100%',
                }}>
                  {member.email}
                </p>
              )}
            </div>
          ))}
        </div>

        {showInviteModal && church && (
          <InviteMemberModal
            church={church}
            onClose={() => setShowInviteModal(false)}
          />
        )}

        {manageMember && (
          <div
            onClick={() => setManageMember(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--color-surface)', borderRadius: 'var(--radius-md)',
                padding: 'var(--space-lg)', width: 320, display: 'flex', flexDirection: 'column', gap: 'var(--space-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                {manageMember.image_url ? (
                  <img src={manageMember.image_url} alt={manageMember.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    {(manageMember.name || manageMember.email || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p style={{ fontWeight: 600, margin: 0 }}>{manageMember.name || manageMember.email}</p>
                  {manageMember.name && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0 }}>{manageMember.email}</p>}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Access level</label>
                <select
                  value={manageMember.role}
                  onChange={async (e) => {
                    const newRole = e.target.value
                    try {
                      await api.put(`/api/members/${manageMember.id}/role`, { role: newRole })
                      setMembers(prev => prev.map(m => m.id === manageMember.id ? { ...m, role: newRole } : m))
                      setManageMember((prev: any) => ({ ...prev, role: newRole }))
                    } catch (err: any) {
                      alert(err.response?.data?.error || 'Failed to update role')
                    }
                  }}
                  style={{ padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 'var(--text-sm)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer' }}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--color-border)' }}>
                <button
                  onClick={async () => {
                    if (!confirm(`Remove ${manageMember.name || manageMember.email} from ${church?.name}?`)) return
                    try {
                      await api.delete(`/api/members/${manageMember.id}`)
                      setMembers(prev => prev.filter(m => m.id !== manageMember.id))
                      setManageMember(null)
                    } catch (err: any) {
                      alert(err.response?.data?.error || 'Failed to remove member')
                    }
                  }}
                  style={{ padding: '6px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', background: 'var(--color-surface)', color: 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Remove member
                </button>
                <button
                  onClick={() => setManageMember(null)}
                  className="btn btn-ghost"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
