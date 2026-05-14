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
    <div className="modal-overlay modal-overlay--front">
      <div onClick={onClose} className="modal-backdrop" />

      <div className="modal-panel modal-panel--sm">
        <div className="modal-header modal-header--tight">
          <h2 className="modal-title">
            Add to plan
          </h2>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        <p className="modal-subtitle">
          Adding <strong>{song.title}</strong> to:
        </p>

        {error && <div className="error-box">{error}</div>}

        {loading ? (
          <p className="text-muted">Loading plans...</p>
        ) : plans.length === 0 ? (
          <div className="card-empty">
            <Calendar size={32} className="empty-icon" />
            <p className="text-muted empty-message">No upcoming plans.</p>
            <button
              onClick={() => { onClose(); router.push('/plans/new') }}
              className="btn btn-primary btn-sm"
            >
              <Plus size={14} /> Create a plan
            </button>
          </div>
        ) : (
          <div className="plan-picker-list">
            {plans.map(plan => (
              <div
                key={plan.id}
                className="plan-picker-card"
                style={{ border: `1px solid ${added === plan.id ? 'var(--color-accent)' : 'var(--color-border)'}` }}
              >
                <div className="dash-row-content">
                  <p className="dash-row-title">
                    {format(parseISO(plan.plan_date), 'd MMMM yyyy')}
                    {plan.plan_time && <span className="plan-time-muted"> · {plan.plan_time}</span>}
                  </p>
                  {plan.title && <p className="dash-row-meta">{plan.title}</p>}
                </div>

                {added === plan.id ? (
                  <div className="btn-group">
                    <span className="added-label">Added</span>
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
                    className="btn btn-primary btn-sm flex-shrink-0"
                  >
                    <Plus size={14} />
                    {adding === plan.id ? 'Adding...' : 'Add'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="modal-footer modal-footer--end">
          <button onClick={onClose} className="btn btn-secondary">Close</button>
        </div>
      </div>
    </div>
  )
}
