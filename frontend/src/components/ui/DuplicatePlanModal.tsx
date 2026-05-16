'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import api from '@/lib/api'

interface Props {
  plan: {
    id: string
    plan_date: string
    plan_time: string | null
    plan_start_time: string | null
    plan_sort_order: number
    title: string | null
  }
  onClose: () => void
  onDuplicated: (newId: string) => void
}

export function DuplicatePlanModal({ plan, onClose, onDuplicated }: Props) {
  const [date, setDate] = useState(plan.plan_date)
  const [time, setTime] = useState(plan.plan_time ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!date) { setError('Date is required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await api.post(`/api/plans/${plan.id}/duplicate`, {
        plan_date: date,
        plan_time: time || null,
        plan_start_time: plan.plan_start_time,
        plan_sort_order: plan.plan_sort_order ?? 0,
        title: plan.title,
      })
      onDuplicated(res.data.id)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Duplicate plan</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="text-muted" style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
          The new plan will be saved as a draft with the same running order and musicians. Update the date and time for the new service.
        </p>

        <div className="form-group">
          <label className="form-label">Date</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Time <span className="text-muted">(optional)</span></label>
          <input
            type="text"
            className="input"
            placeholder="e.g. 10:30am"
            value={time}
            onChange={e => setTime(e.target.value)}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Duplicating…' : 'Duplicate plan'}
          </button>
        </div>
      </div>
    </div>
  )
}