'use client'

import { useState, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'
import { InviteMemberModal } from '@/components/ui/InviteMemberModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface UnavailabilityEntry {
  id: string
  start_date: string
  end_date: string
  note: string | null
  name: string
  email: string
}

export default function TeamPage() {
  const { church, isAdmin } = useChurch()
  const [members, setMembers] = useState<any[]>([])
  const [unavailability, setUnavailability] = useState<UnavailabilityEntry[]>([])
  const [availableRoles, setAvailableRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [manageMember, setManageMember] = useState<any>(null)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState<'unavailability' | 'roles' | 'permissions'>('unavailability')
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!church || fetchedRef.current) return
    fetchedRef.current = true
    Promise.all([
      api.get('/api/members').then(r => {
        const sorted = [...r.data].sort((a, b) => {
          if (a.role === 'admin' && b.role !== 'admin') return -1
          if (a.role !== 'admin' && b.role === 'admin') return 1
          return 0
        })
        setMembers(sorted)
      }),
      api.get('/api/unavailability/team').then(r => setUnavailability(r.data)),
      api.get(`/api/churches/${church.id}/roles`).then(r => {
        const names = r.data.map((role: { name: string }) => role.name)
        setAvailableRoles(names)
      }),
    ])
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [church])

  if (!isAdmin) {
    return (
      <div className="settings-restricted">
        <p className="settings-restricted-text">Only admins can manage the team.</p>
      </div>
    )
  }

  const formatDateRange = (entry: UnavailabilityEntry) => {
    const start = parseISO(entry.start_date)
    const end = parseISO(entry.end_date)
    if (entry.start_date === entry.end_date) return format(start, 'd MMM yyyy')
    return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`
  }
  
  return (
    <div>
      <div className="settings-page-header">
        <h1 className="settings-title">Team</h1>
        <p className="settings-subtitle">Manage members and their permissions</p>
      </div>

      {/* Members grid */}
      <div className="settings-card settings-card--spaced">
        <div className="card-header-row">
          <h2 className="settings-section-heading settings-section-heading--tight">Members</h2>
          <button onClick={() => setShowInviteModal(true)} className="btn btn-ghost">
            Invite member +
          </button>
        </div>
        <p className="settings-section-desc">Click a team member to manage their role and permissions.</p>

        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : (
          <div className="member-grid">
            {members.map((member) => (
              <div
                key={member.id}
                className="member-card"
                onClick={() => { setManageMember(member); setActiveTab('unavailability') }}
              >
                <div className="member-card-row1">
                  <div className="member-avatar-wrap">
                    {member.image_url ? (
                      <img src={member.image_url} alt={member.name || member.email} className="member-avatar-img" />
                    ) : (
                      <div className="member-avatar-placeholder">
                        {(member.name || member.email || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    {member.role === 'admin' && (
                      <span className="member-admin-badge">A</span>
                    )}
                  </div>
                  <p className="member-name-label">{member.name || member.email}</p>
                </div>
                <div className="member-card-info">
                  <p className="member-email-label">{member.email}</p>
                  {member.default_roles?.length > 0 && (
                    <div className="member-card-roles">
                      {member.default_roles.map((r: string) => (
                        <span key={r} className="member-card-role-badge">{r}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setManageMember(member); setActiveTab('unavailability') }}
                  className="btn btn-ghost"
                  style={{ flexShrink: 0, fontSize: 'var(--text-xs)' }}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showInviteModal && church && (
        <InviteMemberModal
          church={church}
          onClose={() => setShowInviteModal(false)}
        />
      )}

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

      {manageMember && (
        <div onClick={() => setManageMember(null)} className="manage-member-backdrop">
          <div onClick={(e) => e.stopPropagation()} className="manage-member-modal">

            {/* Header */}
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

            {/* Tabs */}
            <div className="manage-member-tabs">
              {(['unavailability', 'roles', 'permissions'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="manage-member-tab"
                  style={{
                    borderBottom: activeTab === tab ? '2px solid var(--color-brand-500)' : '2px solid transparent',
                    color: activeTab === tab ? 'var(--color-brand-500)' : 'var(--color-text-secondary)',
                    fontWeight: activeTab === tab ? 600 : 400,
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Unavailability tab */}
            {activeTab === 'unavailability' && (() => {
              const memberUnavail = unavailability.filter(u => u.email === manageMember.email)
              return memberUnavail.length === 0 ? (
                <p className="text-muted" style={{ padding: '1rem 0' }}>No unavailability declared.</p>
              ) : (
                <div className="team-unavail-list" style={{ marginTop: '0.75rem' }}>
                  {memberUnavail.map(entry => (
                    <div key={entry.id} className="team-unavail-badge">
                      {formatDateRange(entry)}{entry.note ? ` · ${entry.note}` : ''}
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Roles tab */}
            {activeTab === 'roles' && (
              <div style={{ paddingTop: '0.75rem' }}>
                <p className="settings-section-desc" style={{ marginBottom: '0.75rem' }}>
                  Default roles pre-fill when adding this member to a plan.
                </p>
                <div className="file-group">
                  {availableRoles.map(r => {
                    const selected = (manageMember.default_roles || []).includes(r)
                    return (
                      <button
                        key={r}
                        onClick={async () => {
                          const current: string[] = manageMember.default_roles || []
                          const updated = selected
                            ? current.filter((x: string) => x !== r)
                            : [...current, r]
                          try {
                            await api.put(`/api/members/${manageMember.id}/default_roles`, { default_roles: updated })
                            setMembers(prev => prev.map(m => m.id === manageMember.id ? { ...m, default_roles: updated } : m))
                            setManageMember((prev: any) => ({ ...prev, default_roles: updated }))
                          } catch (err: any) {
                            alert(err.response?.data?.error || 'Failed to update roles')
                          }
                        }}
                        className="role-chip-btn"
                        style={{
                          borderColor: selected ? 'var(--color-brand-600)' : 'var(--color-border)',
                          background: selected ? 'var(--color-brand-600)' : 'var(--color-surface)',
                          color: selected ? '#fff' : 'var(--color-text-secondary)',
                        }}
                      >
                        {r}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Permissions tab */}
            {activeTab === 'permissions' && (
              <div style={{ paddingTop: '0.75rem' }}>
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
                      { key: 'can_add_plans', label: 'Add & edit plans' },
                      { key: 'can_manage_playlists', label: 'Manage playlists' },
                      { key: 'can_annotate_plans', label: 'Add notes to plan items' },
                    ] as { key: 'can_manage_songs' | 'can_add_plans' | 'can_manage_playlists' | 'can_annotate_plans', label: string }[]).map(({ key, label }) => (
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
                                can_manage_playlists: updated.can_manage_playlists,
                                can_annotate_plans: updated.can_annotate_plans,
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
              </div>
            )}

            {/* Footer */}
            <div className="manage-member-footer">
              <button onClick={() => setShowRemoveConfirm(true)} className="btn-muted">
                Remove member
              </button>
              <button onClick={() => setManageMember(null)} className="btn btn-ghost">
                Done
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}