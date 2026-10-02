'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import api from '@/lib/api'

interface PlanTemplateSummary {
  id: string
  name: string
}

interface Props {
  plan: {
    id: string
    plan_date: string
    plan_time: string | null
    title: string | null
  }
  onClose: () => void
}

// Saves the plan's time, title, pre-service notes and running order as a
// template (new, or replacing an existing one). Songs become empty song slots.
export function SaveAsTemplateModal({ plan, onClose }: Props) {
  const [templates, setTemplates] = useState<PlanTemplateSummary[] | null>(null)
  const [mode, setMode] = useState<'new' | 'replace'>('new')
  const [name, setName] = useState(() => {
    if (plan.title) return plan.title
    const day = plan.plan_date ? format(parseISO(plan.plan_date.slice(0, 10)), 'EEEE') : ''
    return [day, plan.plan_time].filter(Boolean).join(' ')
  })
  const [replaceId, setReplaceId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  useEffect(() => {
    api.get('/api/plan-templates')
      .then(r => {
        setTemplates(r.data)
        if (r.data.length > 0) setReplaceId(r.data[0].id)
      })
      .catch(() => setTemplates([]))
  }, [])

  const handleSubmit = async () => {
    setError('')
    if (mode === 'new' && !name.trim()) { setError('Give the template a name'); return }
    if (mode === 'replace' && !replaceId) { setError('Choose a template to replace'); return }
    setSaving(true)
    try {
      if (mode === 'new') {
        await api.post('/api/plan-templates', { plan_id: plan.id, name: name.trim() })
        setDone(`Saved as template “${name.trim()}”.`)
      } else {
        const { data } = await api.put(`/api/plan-templates/${replaceId}/from-plan`, { plan_id: plan.id })
        setDone(`Template “${data.name}” updated from this plan.`)
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const hasTemplates = (templates?.length ?? 0) > 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header modal-header--tight">
          <h2 className="modal-title">Save as template</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {done ? (
          <>
            <p className="template-modal-text">{done} Choose it from <strong>New plan</strong> to start a plan from it, or manage templates in Settings.</p>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <>
            <p className="template-modal-text text-muted">
              Saves this plan&apos;s time, title, pre-service notes and running order. Songs are saved as empty
              song slots to fill each week. Musicians and the date aren&apos;t saved.
            </p>

            {hasTemplates && (
              <div className="template-mode-options">
                <label className="checkbox-row">
                  <input type="radio" name="template-mode" checked={mode === 'new'} onChange={() => setMode('new')} />
                  <span className="checkbox-label">Create a new template</span>
                </label>
                <label className="checkbox-row">
                  <input type="radio" name="template-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                  <span className="checkbox-label">Replace an existing template</span>
                </label>
              </div>
            )}

            {mode === 'new' ? (
              <div>
                <label className="label">Template name</label>
                <input
                  type="text"
                  className="input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Sunday 9.15am"
                  maxLength={100}
                  autoFocus
                />
              </div>
            ) : (
              <div>
                <label className="label">Template to replace</label>
                <select className="input" value={replaceId} onChange={e => setReplaceId(e.target.value)}>
                  {templates!.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <p className="template-modal-hint text-muted">Its name stays the same; everything else is replaced with this plan.</p>
              </div>
            )}

            {error && <div className="error-box">{error}</div>}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || templates === null}>
                {saving ? 'Saving…' : mode === 'new' ? 'Save template' : 'Replace template'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
