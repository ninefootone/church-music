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
  const [form, setForm] = useState({ plan_date: '', plan_time: '', plan_start_time: '', plan_sort_order: 0, title: '', status: 'published' as 'draft' | 'published' })

  useEffect(() => {
    if (!id || churchLoading) return
    api.get(`/api/plans/${id}`)
      .then(r => {
        const s = r.data
        setForm({
          plan_date: s.plan_date?.slice(0, 10) ?? '',
          plan_time: s.plan_time ?? '',
          plan_start_time: s.plan_start_time ? s.plan_start_time.slice(0, 5) : '',
          plan_sort_order: s.plan_sort_order ?? 0,
          title: s.title ?? '',
          status: s.status ?? 'published',
        })
      })
      .catch(() => setError('Failed to load plan'))
      .finally(() => setLoading(false))
  }, [id, churchLoading])

  const handleSave = async (status: 'draft' | 'published') => {
    if (!form.plan_date) { setError('Date is required'); return }
    setSaving(true); setError('')
    try {
      const token = await getToken()
      setAuthToken(token)
      await api.put(`/api/plans/${id}`, { ...form, status })
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
            <label className="label">Start time</label>
            <input className="input" type="time" value={form.plan_start_time} onChange={e => {
              const val = e.target.value
              const formatted = val ? new Date(`1970-01-01T${val}`).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''
              setForm(f => ({ ...f, plan_start_time: val, plan_time: formatted }))
            }} />
            {!form.plan_start_time && (
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
            )}
          </div>
          <div>
            <label className="label">Title <span className="label-note">(optional)</span></label>
            <input className="input" placeholder="e.g. Easter Sunday" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="form-footer">
            <Link href={`/plans/${id}`} className="btn btn-secondary">Cancel</Link>
            <button className="btn btn-secondary" onClick={() => handleSave('draft')} disabled={saving}>
              {saving ? 'Saving…' : form.status === 'draft' ? 'Save draft' : 'Revert to draft'}
            </button>
            <button className="btn btn-primary" onClick={() => handleSave('published')} disabled={saving}>
              {saving ? 'Saving…' : form.status === 'published' ? 'Save changes' : 'Save & publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
