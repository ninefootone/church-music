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
  const [form, setForm] = useState({ service_date: '', service_time: '', title: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.service_date) { setError('Date is required'); return }
    setLoading(true)
    setError('')
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

  const ls: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <Link href="/services" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: 'var(--space-lg)' }}>
        <ArrowLeft size={13} /> Back to services
      </Link>
      <h1 className="page-title" style={{ marginBottom: 'var(--space-lg)' }}>New service</h1>
      {error && <div style={{ background: '#fdf0f0', border: '1px solid #f5c0c0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: '#9a3a3a' }}>{error}</div>}
      <div className="card">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <label style={ls}>Date *</label>
            <input className="input" type="date" required value={form.service_date} onChange={e => setForm(f => ({ ...f, service_date: e.target.value }))} />
          </div>
          <div>
            <label style={ls}>Time</label>
            <input className="input" type="text" placeholder="e.g. 9.15am" value={form.service_time} onChange={e => setForm(f => ({ ...f, service_time: e.target.value }))} />
          </div>
          <div>
            <label style={ls}>Title <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
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
