'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { ArrowLeft } from 'lucide-react'
import api, { setAuthToken } from '@/lib/api'
import { useChurch } from '@/context/ChurchContext'
import { isOnFreePlan, countOwn, FREE_PLAN_LIMIT } from '@/lib/freePlan'

interface PlanTemplate {
  id: string
  name: string
  title: string | null
  plan_time: string | null
  plan_start_time: string | null
  plan_sort_order: number
  pre_service_notes: string | null
  items: { type: string }[]
}

const EMPTY_FORM = { plan_date: '', plan_time: '', plan_start_time: '', plan_sort_order: 0, title: '' }

function formatTime(hhmm: string): string {
  return hhmm ? new Date(`1970-01-01T${hhmm}`).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''
}

export default function NewPlanPage() {
  const router = useRouter()
  const { getToken } = useAuth()
  const { church } = useChurch()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [atLimit, setAtLimit] = useState(false)
  const [templates, setTemplates] = useState<PlanTemplate[]>([])
  const [templateId, setTemplateId] = useState<string | null>(null)

  useEffect(() => {
    if (!church) return
    if (isOnFreePlan(church)) {
      api.get('/api/plans').then(r => {
        if (countOwn(r.data) >= FREE_PLAN_LIMIT) setAtLimit(true)
      }).catch(() => {})
    }
    api.get('/api/plan-templates').then(r => setTemplates(r.data)).catch(() => {})
  }, [church])
  const [form, setForm] = useState(EMPTY_FORM)

  const template = templates.find(t => t.id === templateId) ?? null
  const slotCount = template ? template.items.filter(i => i.type === 'song_slot').length : 0
  const otherCount = template ? template.items.length - slotCount : 0

  // Picking a template pre-fills time and title (date stays as entered);
  // picking Blank clears them again.
  const chooseTemplate = (t: PlanTemplate | null) => {
    setTemplateId(t?.id ?? null)
    const start = t?.plan_start_time ? t.plan_start_time.slice(0, 5) : ''
    setForm(f => ({
      ...f,
      plan_start_time: start,
      plan_time: start ? formatTime(start) : (t?.plan_time ?? ''),
      plan_sort_order: t?.plan_sort_order ?? 0,
      title: t?.title ?? '',
    }))
  }

  const handleSubmit = async (status: 'draft' | 'published') => {
    if (!form.plan_date) { setError('Date is required'); return }
    setLoading(true); setError('')
    try {
      const token = await getToken()
      setAuthToken(token)
      const { data } = await api.post('/api/plans', {
        ...form,
        status,
        ...(template ? { template_id: template.id } : {}),
      })
      // From a template, go straight to the builder to add the songs.
      router.push(template ? `/plans/${data.id}/edit` : `/plans/${data.id}`)
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
        <form className="form-stack">
          {templates.length > 0 && (
            <div>
              <label className="label">Start from</label>
              <div className="template-picker">
                <button
                  type="button"
                  className={`filter-chip${templateId === null ? ' is-active' : ''}`}
                  onClick={() => chooseTemplate(null)}
                >
                  Blank plan
                </button>
                {templates.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`filter-chip${templateId === t.id ? ' is-active' : ''}`}
                    onClick={() => chooseTemplate(t)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              {template && (
                <p className="template-picker-summary">
                  Includes {otherCount} service item{otherCount === 1 ? '' : 's'}
                  {slotCount > 0 && ` and ${slotCount} song slot${slotCount === 1 ? '' : 's'}`}
                  {template.pre_service_notes && ', plus pre-service notes'}.
                  {slotCount > 0 && ' You’ll go straight to the plan to add the songs.'}
                </p>
              )}
            </div>
          )}
          <div>
            <label className="label">Date *</label>
            <input className="input" type="date" required value={form.plan_date} onChange={e => setForm(f => ({ ...f, plan_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Start time</label>
            <input className="input" type="time" value={form.plan_start_time} onChange={e => {
              const val = e.target.value
              setForm(f => ({ ...f, plan_start_time: val, plan_time: formatTime(val) }))
            }} />
          </div>
          <div>
            <label className="label">Title <span className="label-note">(optional)</span></label>
            <input className="input" placeholder="e.g. Easter Sunday" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="form-footer">
            <Link href="/plans" className="btn btn-secondary">Cancel</Link>
            {slotCount > 0 ? (
              // Song slots are still empty, so don't offer Publish here — the plan
              // is created as a draft and opened in the builder.
              <button type="button" className="btn btn-primary" onClick={() => handleSubmit('draft')} disabled={loading}>
                {loading ? 'Creating…' : 'Create and add songs'}
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => handleSubmit('draft')} disabled={loading}>
                  {loading ? 'Saving…' : 'Save as draft'}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => handleSubmit('published')} disabled={loading}>
                  {loading ? 'Publishing…' : 'Publish'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
