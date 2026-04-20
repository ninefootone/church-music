'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { ArrowLeft } from 'lucide-react'
import { useChurch } from '@/context/ChurchContext'
import api, { setAuthToken } from '@/lib/api'

export default function ServiceSettingsPage() {
  const { id } = useParams()
  const router = useRouter()
  const { getToken } = useAuth()
  const { loading: churchLoading } = useChurch()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ service_date: '', service_time: '', service_sort_order: 0, title: '' })

  useEffect(() => {
    if (!id || churchLoading) return
    api.get(`/api/services/${id}`)
      .then(r => {
        const s = r.data
        setForm({
          service_date: s.service_date?.slice(0, 10) ?? '',
          service_time: s.service_time ?? '',
          service_sort_order: s.service_sort_order ?? 0,
          title: s.title ?? '',
        })
      })
      .catch(() => setError('Failed to load service'))
      .finally(() => setLoading(false))
  }, [id, churchLoading])

  const handleSave = async () => {
    if (!form.service_date) { setError('Date is required'); return }
    setSaving(true); setError('')
    try {
      const token = await getToken()
      setAuthToken(token)
      await api.put(`/api/services/${id}`, form)
      router.push(`/services/${id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save')
      setSaving(false)
    }
  }

  if (loading || churchLoading) return <p className="text-muted" style={{ padding: 'var(--space-xl)' }}>Loading…</p>

  return (
    <div>
      <Link href={`/services/${id}`} className="back-link"><ArrowLeft size={14} /> Back to service</Link>
      <h1 className="page-title" style={{ marginBottom: 'var(--space-lg)' }}>Edit service details</h1>
      {error && <div className="error-box">{error}</div>}
      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <label className="label">Date *</label>
            <input className="input" type="date" required value={form.service_date} onChange={e => setForm(f => ({ ...f, service_date: e.target.value }))} style={{ maxWidth: '100%' }} />
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
            <Link href={`/services/${id}`} className="btn btn-secondary">Cancel</Link>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
