'use client'

import { useState, useEffect } from 'react'
import { X, Mail, Plus, Trash2 } from 'lucide-react'
import api from '@/lib/api'

interface Member {
  id: string
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
    api.get('/api/members').then(r => {
      const withEmail = r.data.filter((m: Member) => m.email)
      setMembers(withEmail)
      setSelected(new Set(withEmail.map((m: Member) => m.email)))
    }).catch(() => {})
  }, [])

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
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-md)' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      <div style={{ position: 'relative', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-lg)', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={18} style={{ color: 'var(--color-brand-500)' }} />
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>Send Plan Email</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {result ? (
          /* Success state */
          <div style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
            <Mail size={32} style={{ color: 'var(--color-brand-500)', marginBottom: 8 }} />
            <p style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
              Email sent to {result.sent} recipient{result.sent !== 1 ? 's' : ''}
            </p>
            {result.failed > 0 && (
              <p style={{ fontSize: 'var(--text-sm)', color: '#9a3a3a' }}>{result.failed} failed to send.</p>
            )}
            <button onClick={onClose} className="btn btn-primary" style={{ marginTop: 'var(--space-lg)' }}>Done</button>
          </div>
        ) : (
          <>
            {/* Scrollable body */}
            <div style={{ overflowY: 'auto', padding: 'var(--space-lg)', flex: 1 }}>

              {/* Church members */}
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 10 }}>
                Church Members
              </p>
              {members.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic', marginBottom: 16 }}>No members with email addresses found.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                  {members.map(m => (
                    <label key={m.email} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: selected.has(m.email) ? 'var(--color-brand-50)' : 'var(--color-neutral-50)', border: `1px solid ${selected.has(m.email) ? 'var(--color-brand-200)' : 'var(--color-border)'}` }}>
                      <input
                        type="checkbox"
                        checked={selected.has(m.email)}
                        onChange={() => toggleMember(m.email)}
                        style={{ accentColor: 'var(--color-brand-500)', width: 16, height: 16, flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{m.name}</p>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>{m.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Custom addresses */}
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 10 }}>
                Additional Recipients
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Name (optional)"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', fontSize: 'var(--text-sm)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                />
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={customEmail}
                  onChange={e => setCustomEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addExtra()}
                  style={{ flex: 2, padding: '8px 10px', fontSize: 'var(--text-sm)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                />
                <button onClick={addExtra} className="btn btn-secondary" style={{ padding: '8px 12px', flexShrink: 0 }}>
                  <Plus size={16} />
                </button>
              </div>
              {extras.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                  {extras.map(e => (
                    <div key={e.email} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--color-neutral-50)', border: '1px solid var(--color-border)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {e.name && <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{e.name}</p>}
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0 }}>{e.email}</p>
                      </div>
                      <button onClick={() => removeExtra(e.email)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2, display: 'flex' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <p style={{ fontSize: 'var(--text-sm)', color: '#9a3a3a', marginTop: 12 }}>{error}</p>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: 'var(--space-md) var(--space-lg)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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