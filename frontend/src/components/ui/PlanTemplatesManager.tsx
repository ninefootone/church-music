'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useChurch } from '@/context/ChurchContext'
import api, { setAuthToken } from '@/lib/api'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { X, Pencil } from 'lucide-react'

interface TemplateItem {
  type: string
  title: string | null
}

interface PlanTemplate {
  id: string
  name: string
  title: string | null
  plan_time: string | null
  plan_start_time: string | null
  plan_sort_order: number
  pre_service_notes: string | null
  items: TemplateItem[]
}

function formatTime(hhmm: string): string {
  return new Date(`1970-01-01T${hhmm}`).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function summarise(t: PlanTemplate): string {
  const slots = t.items.filter(i => i.type === 'song_slot').length
  const others = t.items.length - slots
  const parts = [
    t.plan_time,
    `${others} service item${others === 1 ? '' : 's'}`,
    `${slots} song slot${slots === 1 ? '' : 's'}`,
  ]
  return parts.filter(Boolean).join(' · ')
}

// Plans → Templates (/plans/templates) and Settings → "Plan templates": list, edit the basic fields, delete. The running
// order itself is changed by building it in a plan and using "Save as template"
// → replace (no second builder). Backend: /api/plan-templates.
export function PlanTemplatesManager() {
  const { getToken } = useAuth()
  const { church } = useChurch()

  const [templates, setTemplates] = useState<PlanTemplate[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PlanTemplate | null>(null)

  useEffect(() => {
    if (!church || loaded) return
    api.get('/api/plan-templates')
      .then(r => { setTemplates(r.data); setLoaded(true) })
      .catch(() => setError('Failed to load plan templates.'))
  }, [church, loaded])

  async function authApi() {
    const token = await getToken()
    setAuthToken(token)
    return api
  }

  function openEdit(t: PlanTemplate) {
    setEditingId(t.id)
    setName(t.name)
    setTitle(t.title || '')
    setStartTime(t.plan_start_time ? t.plan_start_time.slice(0, 5) : '')
    setNotes(t.pre_service_notes || '')
    setError('')
  }
  function closeEditor() {
    setEditingId(null)
  }

  async function handleSave(t: PlanTemplate) {
    if (!name.trim()) { setError('Template name is required.'); return }
    setSaving(true); setError('')
    try {
      const client = await authApi()
      const { data } = await client.put(`/api/plan-templates/${t.id}`, {
        name: name.trim(),
        title: title.trim() || null,
        plan_start_time: startTime || null,
        plan_time: startTime ? formatTime(startTime) : null,
        plan_sort_order: t.plan_sort_order ?? 0,
        pre_service_notes: notes.trim() || null,
      })
      setTemplates(prev => prev.map(x => (x.id === t.id ? data : x)))
      closeEditor()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const client = await authApi()
      await client.delete(`/api/plan-templates/${deleteTarget.id}`)
      setTemplates(prev => prev.filter(t => t.id !== deleteTarget.id))
    } catch {
      setError('Failed to delete.')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="settings-card settings-card--spaced">
      <h2 className="settings-section-heading settings-section-heading--tight">Plan templates</h2>
      <p className="settings-section-desc">
        Starting points for your regular services — time, title, pre-service notes and running order, with empty
        song slots to fill each week. To create one, open a plan and use <strong>Save as template</strong>. To change a
        template&rsquo;s running order, build it in a plan and save it over the existing template.
      </p>

      {error && editingId === null && <div className="settings-error">{error}</div>}

      {loaded && templates.length === 0 && (
        <p className="form-empty-note">No plan templates yet.</p>
      )}

      {templates.length > 0 && (
        <ul className="snippet-list">
          {templates.map(t => (
            editingId === t.id ? (
              <li key={t.id} className="snippet-editing-li">
                <div className="snippet-editor">
                  <label className="settings-label">Template name</label>
                  <input className="input" value={name} onChange={e => setName(e.target.value)} maxLength={100} autoFocus />

                  <label className="settings-label template-field-gap">
                    Plan title <span className="label-note">(optional)</span>
                  </label>
                  <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Morning Worship" />

                  <label className="settings-label template-field-gap">Start time</label>
                  <input className="input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />

                  <label className="settings-label template-field-gap">
                    Pre-service notes <span className="label-note">(optional)</span>
                  </label>
                  <textarea className="input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Band call 8:30am" />

                  {error && <div className="settings-error template-field-gap">{error}</div>}

                  <div className="snippet-editor-actions">
                    <button type="button" onClick={() => handleSave(t)} className="btn btn-primary" disabled={saving}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                    <button type="button" onClick={closeEditor} className="btn btn-secondary" disabled={saving}>
                      Cancel
                    </button>
                  </div>
                </div>
              </li>
            ) : (
              <li key={t.id} className="snippet-row">
                <div className="template-row-main">
                  <span className="snippet-row-title">{t.name}</span>
                  <span className="template-row-meta">{summarise(t)}</span>
                </div>
                <div className="snippet-row-actions">
                  <button type="button" onClick={() => openEdit(t)} className="btn btn-ghost btn-icon-label" disabled={editingId !== null}>
                    <Pencil size={14} />Edit
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(t)} className="btn-icon-remove" title="Delete" disabled={editingId !== null}>
                    <X size={16} />
                  </button>
                </div>
              </li>
            )
          ))}
        </ul>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete plan template?"
          message={`“${deleteTarget.name}” will be removed. Plans already created from it aren't affected.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
