'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { ArrowLeft } from 'lucide-react'
import { useChurch } from '@/context/ChurchContext'
import api, { setAuthToken } from '@/lib/api'

export default function PlanSettingsPage() {
  const { id } = useParams()
  const router = useRouter()
  const { getToken } = useAuth()
  const { loading: churchLoading } = useChurch()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ plan_date: '', plan_time: '', plan_sort_order: 0, title: '' })

  useEffect(() => {
    if (!id || churchLoading) return
    api.get(`/api/plans/${id}`)
      .then(r => {
        const s = r.data
        setForm({
          plan_date: s.plan_date?.slice(0, 10) ?? '',
          plan_time: s.plan_time ?? '',
          plan_sort_order: s.plan_sort_order ?? 0,
          title: s.title ?? '',
        })
      })
      .catch(() => setError('Failed to load plan'))
      .finally(() => setLoading(false))
  }, [id, churchLoading])

  const handleSave = async () => {
    if (!form.plan_date) { setError('Date is required'); return }
    setSaving(true); setError('')
    try {
      const token = await getToken()
      setAuthToken(token)
      await api.put(`/api/plans/${id}`, form)
      router.push(`/plans/${id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save')
      setSaving(false)
    }
  }

  if (loading || churchLoading) return <p className="text-muted dash-loading">Loading…</p>

  return (
    <div>
      <Link href={`/plans/${id}`} className="back-link"><ArrowLeft size={14} /> Back to plan</Link>
      <h1 className="page-title page-title--spaced">Edit plan details</h1>
      {error && <div className="error-box">{error}</div>}
      <div className="card">
        <div className="form-stack">
          <div>
            <label className="label">Date *</label>
            <input className="input" type="date" required value={form.plan_date} onChange={e => setForm(f => ({ ...f, plan_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Time</label>
            <input className="input" type="text" placeholder="e.g. 9.15am" value={form.plan_time} onChange={e => setForm(f => ({ ...f, plan_time: e.target.value }))} />
            <div className="time-btn-group">
              {[{ label: 'Morning', value: 0 }, { label: 'Afternoon', value: 1 }, { label: 'Evening', value: 2 }].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, plan_sort_order: opt.value }))}
                  className={`${form.plan_sort_order === opt.value ? 'btn btn-primary' : 'btn btn-secondary'} btn-time`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Title <span className="label-note">(optional)</span></label>
            <input className="input" placeholder="e.g. Easter Sunday" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="form-footer">
            <Link href={`/plans/${id}`} className="btn btn-secondary">Cancel</Link>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
