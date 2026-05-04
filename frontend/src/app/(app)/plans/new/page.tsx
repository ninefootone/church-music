'use client'

import { useState } from 'react'
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
  const [form, setForm] = useState({ plan_date: '', plan_time: '', plan_sort_order: 0, title: '' })

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
      <h1 className="page-title" style={{ marginBottom: 'var(--space-lg)' }}>New plan</h1>
      {error && <div className="error-box">{error}</div>}
      <div className="card">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <label className="label">Date *</label>
            <input className="input" type="date" required value={form.plan_date} onChange={e => setForm(f => ({ ...f, plan_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Time</label>
            <input className="input" type="text" placeholder="e.g. 9.15am" value={form.plan_time} onChange={e => setForm(f => ({ ...f, plan_time: e.target.value }))} />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {[{ label: 'Morning', value: 0 }, { label: 'Afternoon', value: 1 }, { label: 'Evening', value: 2 }].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, plan_sort_order: opt.value }))}
                  className={form.plan_sort_order === opt.value ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ fontSize: 'var(--text-sm)', padding: '4px 12px' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Title <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>(optional)</span></label>
            <input className="input" placeholder="e.g. Easter Sunday" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 'var(--space-sm)' }}>
            <Link href="/plans" className="btn btn-secondary">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create plan'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
