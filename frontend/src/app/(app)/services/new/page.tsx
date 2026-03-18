'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewServicePage() {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('9.15am')
  const [title, setTitle] = useState('')

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <Link
        href="/services"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: 'var(--space-lg)' }}
      >
        <ArrowLeft size={14} /> Back to services
      </Link>

      <h1 className="page-title" style={{ marginBottom: 'var(--space-xl)' }}>New service</h1>

      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

          <div>
            <label className="label">Date *</label>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div>
            <label className="label">Time</label>
            <input className="input" type="text" placeholder="e.g. 9.15am" value={time} onChange={e => setTime(e.target.value)} />
          </div>

          <div>
            <label className="label">Title <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 11, color: 'var(--color-text-muted)' }}>— optional</span></label>
            <input className="input" type="text" placeholder="e.g. Easter Sunday" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', paddingTop: 'var(--space-sm)' }}>
            <Link href="/services" className="btn btn-secondary">Cancel</Link>
            <button className="btn btn-primary">Create service</button>
          </div>
        </div>
      </div>
    </div>
  )
}
