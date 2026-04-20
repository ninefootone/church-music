'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { ArrowLeft } from 'lucide-react'
import api, { setAuthToken } from '@/lib/api'

export default function NewServicePage() {
  const router = useRouter()
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ service_date: '', service_time: '', service_sort_order: 0, title: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.service_date) { setError('Date is required'); return }
    setLoading(true); setError('')
    try {
      const token = await getToken()
      setAuthToken(token)
      const { data } = await api.post('/api/services', form)
      router.push(`/services/${data.id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create service')
      setLoading(false)
    }
  }

  return (
    <div>
      <Link href="/services" className="back-link"><ArrowLeft size={14} /> Back to services</Link>
      <h1 className="page-title" style={{ marginBottom: 'var(--space-lg)' }}>New service</h1>
      {error && <div className="error-box">{error}</div>}
      <div className="card">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <label className="label">Date *</label>
            <input className="input" type="date" required value={form.service_date} onChange={e => setForm(f => ({ ...f, service_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Time</label>
            <input className="input" type="text" placeholder="e.g. 9.15am" value={form.service_time} onChange={e => setForm(f => ({ ...f, service_time: e.target.value }))} />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {[{ label: 'Morning', value: 0 }, { label: 'Afternoon', value: 1 }, { label: 'Evening', value: 2 }].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, service_sort_order: opt.value }))}
                  className={form.service_sort_order === opt.value ? 'btn btn-primary' : 'btn btn-secondary'}
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
            <Link href="/services" className="btn btn-secondary">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create service'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
