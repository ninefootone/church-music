'use client'

import { useState, useEffect } from 'react'
import { X, UserPlus, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'

interface Member {
  id: string
  name: string
  email: string
  user_id: string
  default_roles?: string[]
}

const DEFAULT_ROLES = ['Vocals', 'Keys', 'Guitar', 'Bass', 'Drums']

interface Props {
  planId: string
  planDate: string
  churchId: string
  onAdd: (musicians: { id: string; name: string; role: string; user_id: string | null }[]) => void
  onClose: () => void
}

export function PlanMusicianModal({ planId, planDate, churchId, onAdd, onClose }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [availableRoles, setAvailableRoles] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [unavailabilityWarning, setUnavailabilityWarning] = useState<string | null>(null)
  const [guestName, setGuestName] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [customRole, setCustomRole] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/members').then(r => setMembers(r.data)).catch(() => {})
    api.get(`/api/churches/${churchId}/roles`).then(r => {
      const names = r.data.map((role: { name: string }) => role.name)
      setAvailableRoles(names.length > 0 ? names : DEFAULT_ROLES)
    }).catch(() => setAvailableRoles(DEFAULT_ROLES))
  }, [churchId])

  const selectMember = async (member: Member) => {
    setSelectedMember(member)
    setQuery('')
    setUnavailabilityWarning(null)
    if (member.default_roles && member.default_roles.length > 0) {
      setSelectedRoles(member.default_roles)
    }
    if (member.user_id && planDate) {
      try {
        const { data } = await api.get('/api/unavailability/check', {
          params: { userId: member.user_id, date: planDate }
        })
        if (data.unavailable) {
          const entry = data.entries[0]
          const note = entry.note ? ` (${entry.note})` : ''
          setUnavailabilityWarning(`${member.name} has marked themselves unavailable on this date${note}.`)
        }
      } catch (err: any) {
        if (err?.response?.status !== 403) console.error(err)
      }
    }
  }

  const filtered = query.length > 0
    ? members.filter(m => m.name?.toLowerCase().includes(query.toLowerCase()) || m.email?.toLowerCase().includes(query.toLowerCase()))
    : []

  const finalName = selectedMember ? selectedMember.name : (guestName.trim() || query.trim())
  const allRoles = showCustom && customRole.trim()
    ? [...selectedRoles, customRole.trim()]
    : selectedRoles

  const canSubmit = finalName.length > 0 && allRoles.length > 0

  const toggleRole = (r: string) => {
    setSelectedRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      const results = await Promise.all(
        allRoles.map(role =>
          api.post(`/api/plans/${planId}/musicians`, {
            name: finalName,
            role,
            user_id: selectedMember?.user_id || null,
          }).then(r => r.data)
        )
      )
      onAdd(results)
      onClose()
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div
      className="bottom-sheet-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bottom-sheet-panel">

        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Add musician</h2>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        {/* Person */}
        <div className="form-field">
          <label className="settings-label">Person</label>

          {selectedMember ? (
            <div>
              <div className="selected-member-display">
                <span className="selected-member-name">{selectedMember.name}</span>
                <button
                  onClick={() => { setSelectedMember(null); setQuery(''); setUnavailabilityWarning(null) }}
                  className="btn-icon-remove"
                >
                  <X size={16} />
                </button>
              </div>
              {unavailabilityWarning && (
                <div className="warning-banner">
                  <AlertTriangle size={16} className="icon-warning" />
                  <p className="warning-text">
                    {unavailabilityWarning} You can still add them if needed.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="tag-input-wrap">
              <input
                type="text"
                placeholder="Search members or type a guest name…"
                value={query}
                onChange={e => { setQuery(e.target.value); setGuestName('') }}
                className="member-search-input"
                style={{ borderRadius: filtered.length > 0 ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)' }}
                autoFocus
              />
              {filtered.length > 0 && (
                <div className="member-search-dropdown">
                  {filtered.slice(0, 5).map(m => (
                    <button
                      key={m.id}
                      onClick={() => selectMember(m)}
                      className="member-search-option"
                    >
                      <span className="member-option-name">{m.name}</span>
                      <span className="member-option-email">{m.email}</span>
                    </button>
                  ))}
                </div>
              )}
              {query.length > 1 && filtered.length === 0 && (
                <p className="form-empty-note">
                  No members found — <strong>{query}</strong> will be added as a guest
                </p>
              )}
            </div>
          )}
        </div>

        {/* Roles */}
        <div className="form-field">
          <label className="settings-label">
            Role / instrument <span className="label-note">(select one or more)</span>
          </label>
          <div className="file-group">
            {availableRoles.map(r => (
              <button
                key={r}
                onClick={() => toggleRole(r)}
                className="role-chip-btn"
                style={{
                  borderColor: selectedRoles.includes(r) ? 'var(--color-brand-600)' : 'var(--color-border)',
                  background: selectedRoles.includes(r) ? 'var(--color-brand-600)' : 'var(--color-surface)',
                  color: selectedRoles.includes(r) ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                {r}
              </button>
            ))}
            <button
              onClick={() => setShowCustom(v => !v)}
              className="role-chip-btn"
              style={{
                borderColor: showCustom ? 'var(--color-brand-600)' : 'var(--color-border)',
                background: showCustom ? 'var(--color-brand-600)' : 'var(--color-surface)',
                color: showCustom ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              Other…
            </button>
          </div>
          {showCustom && (
            <input
              type="text"
              placeholder="e.g. Cajon, Flute…"
              value={customRole}
              onChange={e => setCustomRole(e.target.value)}
              className="custom-role-input"
              autoFocus
            />
          )}
        </div>

        {error && <p className="error-text">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || saving}
          className="btn btn-primary btn-full-center"
          style={{ opacity: canSubmit ? 1 : 0.5 }}
        >
          <UserPlus size={16} />
          {saving ? 'Adding…' : `Add${allRoles.length > 1 ? ` (${allRoles.length} roles)` : ''}`}
        </button>
      </div>
    </div>
  )
}
