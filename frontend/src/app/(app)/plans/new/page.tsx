'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { ArrowLeft } from 'lucide-react'
import api, { setAuthToken } from '@/lib/api'
import { useChurch } from '@/context/ChurchContext'

export default function NewPlanPage() {
  const router = useRouter()
  const { getToken } = useAuth()
  const { church } = useChurch()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [atLimit, setAtLimit] = useState(false)

  useEffect(() => {
    if (!church) return
    const status = church.subscription_status
    if (!status || status === 'free') {
      api.get('/api/plans').then(r => {
        if (r.data.length >= 1) setAtLimit(true)
      }).catch(() => {})
    }
  }, [church])
  const [form, setForm] = useState({ plan_date: '', plan_time: '', plan_start_time: '', plan_sort_order: 0, title: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.plan_date) { setError('Date is required'); return }
    setLoading(true); setError('')
    try {
      const token = await getToken()
      setAuthToken(token)
      const { data } = await api.post('/api/plans', form)
      router.push(`/plans/${data.id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create plan')
      setLoading(false)
    }
  }

  return (
    <div>
      <Link href="/plans" className="back-link"><ArrowLeft size={14} /> Back to plans</Link>
      <h1 className="page-title page-title--spaced">New plan</h1>
      {atLimit && (
        <div className="error-box">
          You've reached the 1 plan limit on the free plan. <Link href="/settings" className="link">Upgrade in Settings</Link> to add more plans.
        </div>
      )}
      {error && <div className="error-box">{error}</div>}
      <div className="card">
        <form onSubmit={handleSubmit} className="form-stack">
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
          </div>
          <div>
            <label className="label">Title <span className="label-note">(optional)</span></label>
            <input className="input" placeholder="e.g. Easter Sunday" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="form-footer">
            <Link href="/plans" className="btn btn-secondary">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create plan'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
