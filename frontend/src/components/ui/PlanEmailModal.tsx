'use client'

import { useState, useEffect } from 'react'
import { X, Mail, Plus, Trash2 } from 'lucide-react'
import api from '@/lib/api'

interface Member {
  id: string
  user_id: string
  name: string
  email: string
}

interface Recipient {
  email: string
  name: string
}

interface Props {
  planId: string
  onClose: () => void
}

export function PlanEmailModal({ planId, onClose }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [customEmail, setCustomEmail] = useState('')
  const [customName, setCustomName] = useState('')
  const [extras, setExtras] = useState<Recipient[]>([])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/api/members'),
      api.get(`/api/plans/${planId}/musicians`),
    ]).then(([membersRes, musiciansRes]) => {
      const withEmail = membersRes.data.filter((m: Member) => m.email)
      setMembers(withEmail)
      const planUserIds = new Set(
        musiciansRes.data
          .filter((pm: { user_id: string | null }) => pm.user_id !== null)
          .map((pm: { user_id: string }) => pm.user_id)
      )
      const preSelected = new Set<string>(
        withEmail
          .filter((m: Member) => planUserIds.has(m.user_id))
          .map((m: Member) => m.email)
      )
      setSelected(preSelected)
    }).catch(() => {})
  }, [planId])

  const toggleMember = (email: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(email) ? next.delete(email) : next.add(email)
      return next
    })
  }

  const addExtra = () => {
    const trimmed = customEmail.trim()
    if (!trimmed || !trimmed.includes('@')) return
    if (extras.find(e => e.email === trimmed)) return
    setExtras(prev => [...prev, { email: trimmed, name: customName.trim() }])
    setCustomEmail('')
    setCustomName('')
  }

  const removeExtra = (email: string) => {
    setExtras(prev => prev.filter(e => e.email !== email))
  }

  const handleSend = async () => {
    setError('')
    const memberRecipients = members
      .filter(m => selected.has(m.email))
      .map(m => ({ email: m.email, name: m.name }))
    const allRecipients = [...memberRecipients, ...extras]
    if (allRecipients.length === 0) {
      setError('Please select at least one recipient.')
      return
    }
    setSending(true)
    try {
      const res = await api.post(`/api/plans/${planId}/email`, { recipients: allRecipients })
      setResult(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to send email.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="modal-overlay modal-overlay--front">
      <div onClick={onClose} className="modal-backdrop" />
      <div className="modal-panel modal-panel--sm modal-panel--flex">

        {/* Header */}
        <div className="modal-header modal-header--bordered">
          <div className="btn-group">
            <Mail size={18} className="icon-brand" />
            <h2 className="modal-title">Send Plan Email</h2>
          </div>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        {result ? (
          /* Success state */
          <div className="card-empty">
            <p className="modal-success-heading">
              Email sent to {result.sent} recipient{result.sent !== 1 ? 's' : ''}
            </p>
            {result.failed > 0 && (
              <p className="text-danger">{result.failed} failed to send.</p>
            )}
            <button onClick={onClose} className="btn btn-primary mt-lg">Done</button>
          </div>
        ) : (
          <>
            {/* Scrollable body */}
            <div className="modal-scroll-body">

              {/* Church members */}
              <p className="sub-section-label">Church Members</p>
              {members.length === 0 ? (
                <p className="form-empty-note">No members with email addresses found.</p>
              ) : (
                <div className="email-member-list">
                  {members.map(m => (
                    <label
                      key={m.email}
                      className="email-member-label"
                      style={{
                        background: selected.has(m.email) ? 'var(--color-brand-50)' : 'var(--color-neutral-50)',
                        border: `1px solid ${selected.has(m.email) ? 'var(--color-brand-200)' : 'var(--color-border)'}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(m.email)}
                        onChange={() => toggleMember(m.email)}
                        style={{ accentColor: 'var(--color-brand-500)', width: 16, height: 16, flexShrink: 0 }}
                      />
                      <div className="dash-row-content">
                        <p className="member-name-sm">{m.name}</p>
                        <p className="member-email-sm">{m.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Custom addresses */}
              <p className="sub-section-label">Additional Recipients</p>
              <div className="btn-group" style={{ marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Name (optional)"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className="extra-input"
                />
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={customEmail}
                  onChange={e => setCustomEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addExtra()}
                  className="extra-input"
                  style={{ flex: 2 }}
                />
                <button onClick={addExtra} className="btn btn-secondary flex-shrink-0" style={{ padding: '8px 12px' }}>
                  <Plus size={16} />
                </button>
              </div>
              {extras.length > 0 && (
                <div className="email-member-list">
                  {extras.map(e => (
                    <div key={e.email} className="extra-entry-row">
                      <div className="dash-row-content">
                        {e.name && <p className="member-name-sm">{e.name}</p>}
                        <p className="member-email-sm">{e.email}</p>
                      </div>
                      <button onClick={() => removeExtra(e.email)} className="btn-icon-remove">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <p className="error-text">{error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="modal-footer modal-footer--padded">
              <button onClick={onClose} className="btn btn-secondary" disabled={sending}>Cancel</button>
              <button onClick={handleSend} className="btn btn-primary" disabled={sending}>
                {sending ? 'Sending…' : `Send Email`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
