'use client'

import { useState, useEffect } from 'react'
import { X, UserPlus } from 'lucide-react'
import api from '@/lib/api'

const PRESET_ROLES = ['Vocals', 'Keys', 'Guitar', 'Bass', 'Drums', 'Other']

interface Member {
  id: string
  name: string
  email: string
  user_id: string
}

interface Props {
  serviceId: string
  onAdd: (musicians: { id: string; name: string; role: string; user_id: string | null }[]) => void
  onClose: () => void
}

export function ServiceMusicianModal({ serviceId, onAdd, onClose }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [query, setQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [guestName, setGuestName] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [customRole, setCustomRole] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/members').then(r => setMembers(r.data)).catch(() => {})
  }, [])

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
          api.post(`/api/services/${serviceId}/musicians`, {
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
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', width: '100%', maxWidth: 520, padding: 'var(--space-lg)', paddingBottom: 'calc(var(--space-lg) + env(safe-area-inset-bottom))' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Add musician</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Person */}
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>Person</label>

          {selectedMember ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--color-neutral-50)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: 'var(--text-md)', fontWeight: 500 }}>{selectedMember.name}</span>
              <button onClick={() => { setSelectedMember(null); setQuery('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2 }}>
                <X size={16} />
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search members or type a guest name…"
                value={query}
                onChange={e => { setQuery(e.target.value); setGuestName('') }}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: filtered.length > 0 ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)', fontSize: 'var(--text-md)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
                autoFocus
              />
              {filtered.length > 0 && (
                <div style={{ border: '1px solid var(--color-border)', borderTop: 'none', borderRadius: '0 0 var(--radius-sm) var(--radius-sm)', overflow: 'hidden' }}>
                  {filtered.slice(0, 5).map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedMember(m); setQuery('') }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'var(--color-surface)', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', fontSize: 'var(--text-md)' }}
                    >
                      <span style={{ fontWeight: 500 }}>{m.name}</span>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginLeft: 8 }}>{m.email}</span>
                    </button>
                  ))}
                </div>
              )}
              {query.length > 1 && filtered.length === 0 && (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 6 }}>
                  No members found — <strong>{query}</strong> will be added as a guest
                </p>
              )}
            </div>
          )}
        </div>

        {/* Roles */}
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
            Role / instrument <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(select one or more)</span>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PRESET_ROLES.map(r => (
              <button
                key={r}
                onClick={() => toggleRole(r)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid',
                  borderColor: selectedRoles.includes(r) ? 'var(--color-brand-600)' : 'var(--color-border)',
                  background: selectedRoles.includes(r) ? 'var(--color-brand-600)' : 'var(--color-surface)',
                  color: selectedRoles.includes(r) ? '#fff' : 'var(--color-text-secondary)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {r}
              </button>
            ))}
            <button
              onClick={() => setShowCustom(v => !v)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid',
                borderColor: showCustom ? 'var(--color-brand-600)' : 'var(--color-border)',
                background: showCustom ? 'var(--color-brand-600)' : 'var(--color-surface)',
                color: showCustom ? '#fff' : 'var(--color-text-secondary)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                cursor: 'pointer',
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
              style={{ marginTop: 10, width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-md)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
              autoFocus
            />
          )}
        </div>

        {error && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-error)', marginBottom: 'var(--space-sm)' }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || saving}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', opacity: canSubmit ? 1 : 0.5 }}
        >
          <UserPlus size={16} />
          {saving ? 'Adding…' : `Add${allRoles.length > 1 ? ` (${allRoles.length} roles)` : ''}`}
        </button>
      </div>
    </div>
  )
}