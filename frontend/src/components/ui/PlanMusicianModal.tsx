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

// Passed when CHANGING someone already on the plan (Plans overview). plan_musicians has one row
// per role, so a person is several rows; `rows` are theirs, with the row id for each role.
export interface ExistingMusician {
  name: string
  user_id: string | null
  rows: { id: string; role: string }[]
}

interface Props {
  planId: string
  planDate: string
  churchId: string
  existing?: ExistingMusician
  onAdd: (musicians: { id: string; name: string; role: string; user_id: string | null }[]) => void
  onRemove?: (removedIds: string[]) => void
  onClose: () => void
}

export function PlanMusicianModal({ planId, planDate, churchId, existing, onAdd, onRemove, onClose }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [availableRoles, setAvailableRoles] = useState<string[]>([])
  // Editing a guest: their name starts in the search box. Editing a member: they start selected.
  const [query, setQuery] = useState(existing && !existing.user_id ? existing.name : '')
  const [selectedMember, setSelectedMember] = useState<Member | null>(
    existing?.user_id ? { id: '', name: existing.name, email: '', user_id: existing.user_id } : null
  )
  const [unavailabilityWarning, setUnavailabilityWarning] = useState<string | null>(null)
  const [guestName, setGuestName] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>(existing ? existing.rows.map(r => r.role) : [])
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

  // Roles already chosen that aren't in the church's list (custom ones, or a member's default
  // roles) still need a chip, otherwise they'd be saved without the user seeing them.
  const roleChips = [...availableRoles, ...selectedRoles.filter(r => !availableRoles.includes(r))]

  const toggleRole = (r: string) => {
    setSelectedRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      // Changing someone: same person → only add/remove the roles that changed; a different
      // person → add all the new rows and remove all the old ones. New rows are added BEFORE old
      // ones are removed, so a failure part-way leaves an extra row rather than losing someone.
      const newUserId = selectedMember?.user_id || null
      const samePerson = !!existing && newUserId === existing.user_id &&
        (!!existing.user_id || finalName.trim().toLowerCase() === existing.name.trim().toLowerCase())
      const oldRoles = existing ? existing.rows.map(r => r.role) : []
      const rolesToAdd = samePerson ? allRoles.filter(r => !oldRoles.includes(r)) : allRoles
      const idsToRemove = !existing ? [] : samePerson
        ? existing.rows.filter(r => !allRoles.includes(r.role)).map(r => r.id)
        : existing.rows.map(r => r.id)

      const results = await Promise.all(
        rolesToAdd.map(role =>
          api.post(`/api/plans/${planId}/musicians`, {
            name: finalName,
            role,
            user_id: newUserId,
          }).then(r => r.data)
        )
      )
      await Promise.all(idsToRemove.map(rid => api.delete(`/api/plans/${planId}/musicians/${rid}`)))
      onAdd(results)
      if (idsToRemove.length > 0) onRemove?.(idsToRemove)
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
          <h2 className="modal-title">{existing ? 'Change musician' : 'Add musician'}</h2>
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
            <div>
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
            {roleChips.map(r => (
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
          {existing
            ? (saving ? 'Saving…' : 'Save changes')
            : (saving ? 'Adding…' : `Add${allRoles.length > 1 ? ` (${allRoles.length} roles)` : ''}`)}
        </button>
      </div>
    </div>
  )
}
