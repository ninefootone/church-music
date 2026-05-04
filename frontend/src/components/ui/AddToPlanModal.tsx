'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Plus, Calendar } from 'lucide-react'
import { format, parseISO, isFuture, isToday } from 'date-fns'
import api from '@/lib/api'

interface AddToPlanModalProps {
  song: {
    id: string
    title: string
    default_key?: string
  }
  onClose: () => void
}

export function AddToPlanModal({ song, onClose }: AddToPlanModalProps) {
  const router = useRouter()
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/plans', { params: { upcoming: 'true' } })
      .then(r => setPlans(r.data))
      .catch(() => setError('Failed to load plans'))
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async (plan: any) => {
    setAdding(plan.id)
    setError('')
    try {
      // Fetch current items
      const { data } = await api.get(`/api/plans/${plan.id}`)
      const currentItems = (data.items || []).map((item: any) => ({
        type: item.type,
        song_id: item.song_id || null,
        title: item.title || null,
        notes: item.notes || null,
        key_override: item.key_override || null,
      }))

      // Append the new song
      const newItems = [...currentItems, {
        type: 'song',
        song_id: song.id,
        title: null,
        notes: null,
        key_override: song.default_key || null,
      }]

      await api.put(`/api/plans/${plan.id}/items`, { items: newItems })
      setAdded(plan.id)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add song')
    } finally {
      setAdding(null)
    }
  }

  const handleViewPlan = (planId: string) => {
    onClose()
    router.push(`/plans/${planId}`)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-md)' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />

      <div style={{ position: 'relative', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
            Add to plan
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-lg)' }}>
          Adding <strong>{song.title}</strong> to:
        </p>

        {error && <div className="error-box">{error}</div>}

        {loading ? (
          <p className="text-muted">Loading plans...</p>
        ) : plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
            <Calendar size={32} style={{ color: 'var(--color-text-muted)', margin: '0 auto 12px' }} />
            <p className="text-muted" style={{ marginBottom: 'var(--space-md)' }}>No upcoming plans.</p>
            <button
              onClick={() => { onClose(); router.push('/plans/new') }}
              className="btn btn-primary btn-sm"
            >
              <Plus size={14} /> Create a plan
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
            {plans.map(plan => (
              <div
                key={plan.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--space-md)', background: 'var(--color-neutral-50)', border: `1px solid ${added === plan.id ? 'var(--color-accent)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', transition: 'border-color var(--transition-fast)' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="dash-row-title">
                    {format(parseISO(plan.plan_date), 'd MMMM yyyy')}
                    {plan.plan_time && <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}> · {plan.plan_time}</span>}
                  </p>
                  {plan.title && <p className="dash-row-meta">{plan.title}</p>}
                </div>

                {added === plan.id ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent-dark)', fontWeight: 500 }}>Added</span>
                    <button
                      onClick={() => handleViewPlan(plan.id)}
                      className="btn btn-secondary btn-sm"
                    >
                      View plan
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAdd(plan)}
                    disabled={adding === plan.id}
                    className="btn btn-primary btn-sm"
                    style={{ flexShrink: 0 }}
                  >
                    <Plus size={14} />
                    {adding === plan.id ? 'Adding...' : 'Add'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 'var(--space-lg)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-secondary">Close</button>
        </div>
      </div>
    </div>
  )
}
