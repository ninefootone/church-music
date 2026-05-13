'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Users } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [manageMember, setManageMember] = useState<any>(null)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
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

  // Group unavailability by member email
  const grouped = unavailability.reduce((acc, entry) => {
    if (!acc[entry.email]) acc[entry.email] = { name: entry.name, email: entry.email, entries: [] }
    acc[entry.email].entries.push(entry)
    return acc
  }, {} as Record<string, { name: string, email: string, entries: UnavailabilityEntry[] }>)

  const membersWithUnavailability = Object.values(grouped).sort((a, b) =>
    (a.name || a.email).localeCompare(b.name || b.email)
  )

  return (
    <div>
      <div className="settings-page-header">
        <div className="settings-icon-wrap">
          <Users size={20} color="white" />
        </div>
        <div>
          <h1 className="settings-title">Team</h1>
          <p className="settings-subtitle">Manage members and their permissions</p>
        </div>
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
                onClick={() => setManageMember(member)}
                className="member-card"
                style={{ cursor: 'pointer' }}
              >
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
                <p className="member-email-label">{member.email}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unavailability */}
      <div className="settings-card settings-card--spaced">
        <h2 className="settings-section-heading settings-section-heading--tight">Team unavailability</h2>
        <p className="settings-section-desc">Dates team members have marked themselves as unavailable.</p>

        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : membersWithUnavailability.length === 0 ? (
          <p className="text-muted">No unavailability declared yet.</p>
        ) : (
          <div className="team-unavail-list">
            {membersWithUnavailability.map(member => (
              <div key={member.email} className="team-unavail-row">
                <div className="team-unavail-name">{member.name || member.email}</div>
                <div className="team-unavail-dates">
                  {member.entries.map(entry => (
                    <span key={entry.id} className="team-unavail-badge">
                      {formatDateRange(entry)}{entry.note ? ` · ${entry.note}` : ''}
                    </span>
                  ))}
                </div>
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
                  { key: 'can_edit_any_plan', label: "Edit anyone's plans" },
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