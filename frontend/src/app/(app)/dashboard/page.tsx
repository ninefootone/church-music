'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'
import { InviteMemberModal } from '@/components/ui/InviteMemberModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

export default function DashboardPage() {
  const { church, loading: churchLoading, isAdmin, canManageSongs, canAddPlans } = useChurch()
  const [songs, setSongs] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [manageMember, setManageMember] = useState<any>(null)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  useEffect(() => {
    if (!church || fetchedRef.current) return
    fetchedRef.current = true
    Promise.all([
      api.get('/api/songs').then(r => setSongs(r.data.slice(0, 4))),
      // Only fetch upcoming plans, ascending so next plan is first
      api.get('/api/plans', { params: { upcoming: 'true' } }).then(r => setPlans(r.data.slice(0, 4))),
      api.get('/api/members').then(r => {
        const sorted = [...r.data].sort((a, b) => {
          if (a.role === 'admin' && b.role !== 'admin') return -1
          if (a.role !== 'admin' && b.role === 'admin') return 1
          return 0
        })
        setMembers(sorted)
      }),
    ]).finally(() => setLoading(false))
  }, [church])

  const isToday = (dateStr: string) => {
    const today = new Date()
    const d = parseISO(dateStr)
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  }

  if (churchLoading || (loading && !songs.length)) return (
    <p className="text-muted dash-loading">Loading…</p>
  )

  const handleUpgrade = async (priceId: string) => {
    if (!church) return
    try {
      const { data } = await api.post('/api/stripe/create-checkout-session', {
        priceId,
        churchId: church.id,
      })
      window.location.href = data.url
    } catch (err) {
      alert('Something went wrong. Please try again.')
    }
  }

  return (
    <div>
      {isAdmin && (!church?.subscription_status || church?.subscription_status === 'free') && (
        <div className="card dash-upgrade-banner">
          <div className="dash-upgrade-inner">
            <div>
              <p className="dash-card-heading">You're on the free plan</p>
              <p className="dash-card-subtext">Limited to 5 songs and 1 plan. Upgrade to unlock everything.</p>
            </div>
            <div className="dash-upgrade-actions">
              <button onClick={() => handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!)} className="btn btn-ghost">
                £5 / month
              </button>
              <button onClick={() => handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL!)} className="btn btn-primary">
                £50 / year
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="dashboard-grid">

        {/* Songs */}
        <div className="card">
          <div className="card-header-row">
            <span className="section-label">Songs</span>
            {canManageSongs && <Link href="/songs/new" className="btn btn-ghost">Add new +</Link>}
          </div>
          {songs.length === 0 ? (
            <p className="text-muted">No songs yet.{canManageSongs && <> <Link href="/songs/new" className="link">Add your first</Link></>}</p>
          ) : songs.map((song) => (
            <Link key={song.id} href={`/songs/${song.id}`} className="dash-row">
              <div className="dash-row-content">
                <p className="dash-row-title">{song.title}</p>
                <div className="dash-row-body">
                  {song.first_line && (
                    <span className="dash-row-meta dash-row-meta--italic">{song.first_line}</span>
                  )}
                  <div className="song-row-badges-mobile">
                    {song.default_key && <KeyBadge keyOf={song.default_key} />}
                    {song.category && <CategoryBadge category={song.category} />}
                  </div>
                  <div className="dash-row-dates">
                    {song.last_sung && (
                      <span className="dash-row-meta dash-row-meta--xs">
                        <strong>Last sung</strong>{' '}{format(parseISO(song.last_sung as string), 'd MMM yyyy')}
                      </span>
                    )}
                    {song.next_planned && (
                      <span className="dash-row-meta dash-row-meta--xs">
                        <strong>Planned</strong>{' '}{format(parseISO(song.next_planned as string), 'd MMM yyyy')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="song-row-badges-desktop">
                {song.default_key && <KeyBadge keyOf={song.default_key} />}
                {song.category && <CategoryBadge category={song.category} />}
              </div>
            </Link>
          ))}
          <div className="card-footer">
            <Link href="/songs" className="btn btn-ghost">View all songs →</Link>
          </div>
        </div>

        {/* Plans — upcoming only */}
        <div className="card">
          <div className="card-header-row">
            <span className="section-label">Plans</span>
            {canAddPlans && <Link href="/plans/new" className="btn btn-ghost">Add new +</Link>}
          </div>
          {plans.length === 0 ? (
            <p className="text-muted">No upcoming plans. {canAddPlans && <Link href="/plans/new" className="link">Add one +</Link>}</p>
          ) : plans.map((plan) => {
            const date = parseISO(plan.plan_date)
            return (
              <Link key={plan.id} href={`/plans/${plan.id}`} className="dash-row">
                <div className="dash-row-content">
                  <p className="dash-row-title">
                    {format(date, 'd MMM')}{plan.plan_time ? ` · ${plan.plan_time}` : ''}
                  </p>
                  {plan.title && <p className="dash-row-meta">{plan.title}</p>}
                </div>
                <span className={`badge ${isToday(plan.plan_date) ? 'badge-today' : 'badge-upcoming'}`}>
                  {isToday(plan.plan_date) ? 'TODAY' : 'UPCOMING'}
                </span>
              </Link>
            )
          })}
          <div className="card-footer">
            <Link href="/plans" className="btn btn-ghost">View all →</Link>
          </div>
        </div>
      </div>

      {/* Team */}
      <div className="card">
        <div className="card-header-row">
          <span className="section-label">Team</span>
          {isAdmin && (
            <button onClick={() => setShowInviteModal(true)} className="btn btn-ghost">
              Invite member +
            </button>
          )}
        </div>

        <div className="member-grid">
          {members.map((member) => (
            <div
              key={member.id}
              onClick={() => isAdmin && setManageMember(member)}
              className="member-card"
              style={{ cursor: isAdmin ? 'pointer' : 'default' }}
            >
              <div className="member-avatar-wrap">
                {member.image_url ? (
                  <img
                    src={member.image_url}
                    alt={member.name || member.email}
                    className="member-avatar-img"
                  />
                ) : (
                  <div className="member-avatar-placeholder">
                    {(member.name || member.email || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                {member.role === 'admin' && (
                  <span className="member-admin-badge">A</span>
                )}
              </div>
              <p className="member-name-label">
                {member.name || member.email}
              </p>
              {isAdmin && member.email && (
                <p className="member-email-label">
                  {member.email}
                </p>
              )}
            </div>
          ))}
        </div>

        {showRemoveConfirm && manageMember && (
          <ConfirmModal
            title="Remove member"
            message={`Remove ${manageMember.name || manageMember.email} from ${church?.name}? They will lose access immediately.`}
            confirmLabel="Remove"
            danger
            onConfirm={async () => {
              try {
                await api.delete(`/api/members/${manageMember.id}`)
                setMembers(prev => prev.filter(m => m.id !== manageMember.id))
                setManageMember(null)
              } catch (err: any) {
                alert(err.response?.data?.error || 'Failed to remove member')
              } finally {
                setShowRemoveConfirm(false)
              }
            }}
            onCancel={() => setShowRemoveConfirm(false)}
          />
        )}
        {showInviteModal && church && (
          <InviteMemberModal
            church={church}
            onClose={() => setShowInviteModal(false)}
          />
        )}

        {manageMember && (
          <div
            onClick={() => setManageMember(null)}
            className="manage-member-backdrop"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="manage-member-modal"
            >
              <div className="manage-member-header">
                {manageMember.image_url ? (
                  <img src={manageMember.image_url} alt={manageMember.name} className="manage-member-avatar-img" />
                ) : (
                  <div className="manage-member-avatar-placeholder">
                    {(manageMember.name || manageMember.email || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="manage-member-name">{manageMember.name || manageMember.email}</p>
                  {manageMember.name && <p className="manage-member-email">{manageMember.email}</p>}
                </div>
              </div>

              <div className="manage-member-field">
                <label className="manage-member-label">Access level</label>
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
                  className="manage-member-select"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {manageMember.role === 'member' && (
                <div className="manage-member-perms">
                  <label className="manage-member-label">Permissions</label>
                  {([
                    { key: 'can_manage_songs', label: 'Add & edit songs' },
                    { key: 'can_add_plans', label: 'Add plans' },
                    { key: 'can_edit_any_plan', label: 'Edit anyone\'s plans' },
                  ] as { key: 'can_manage_songs' | 'can_add_plans' | 'can_edit_any_plan', label: string }[]).map(({ key, label }) => (
                    <label key={key} className="manage-member-perm-label">
                      <input
                        type="checkbox"
                        checked={!!manageMember[key]}
                        onChange={async (e) => {
                          const updated = { ...manageMember, [key]: e.target.checked }
                          try {
                            await api.put(`/api/members/${manageMember.id}/permissions`, {
                              can_manage_songs: updated.can_manage_songs,
                              can_add_plans: updated.can_add_plans,
                              can_edit_any_plan: updated.can_edit_any_plan,
                            })
                            setMembers(prev => prev.map(m => m.id === manageMember.id ? updated : m))
                            setManageMember(updated)
                          } catch (err: any) {
                            alert(err.response?.data?.error || 'Failed to update permissions')
                          }
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}

              <div className="manage-member-footer">
                <button
                  onClick={() => setShowRemoveConfirm(true)}
                  className="btn-muted"
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
