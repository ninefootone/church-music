'use client'

// "Add item" box for the Plans overview: add a non-song item to the end of one plan — a chip from
// the church's Service items library (title, content and note copied, as in the builder), a
// one-off item with a typed title ("Other"), or a "song to be chosen" slot. Uses the single-item
// POST /api/plans/:id/items route. Content and notes are edited in the builder, not here.

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import api from '@/lib/api'
import { DEFAULT_SERVICE_ITEMS } from '@/lib/planItems'

interface Snippet {
  id?: string
  title: string
}

interface Props {
  planId: string
  planTitle: string
  planDate: string
  churchId: string
  onAdded: () => void
  onConflict: (message: string) => void
  onClose: () => void
}

export function OverviewItemAdder({ planId, planTitle, planDate, churchId, onAdded, onConflict, onClose }: Props) {
  const [snippets, setSnippets] = useState<Snippet[] | null>(null)
  const [otherTitle, setOtherTitle] = useState('')
  const [slotLabel, setSlotLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Same rule as the builder: the church's own library, or the default chips if it has none
  // (or it fails to load — the defaults still work).
  useEffect(() => {
    api
      .get(`/api/churches/${churchId}/liturgy-snippets`)
      .then((r) => setSnippets(r.data.length > 0 ? r.data : DEFAULT_SERVICE_ITEMS))
      .catch(() => setSnippets(DEFAULT_SERVICE_ITEMS))
  }, [churchId])

  const add = async (body: Record<string, unknown>) => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await api.post(`/api/plans/${planId}/items`, body)
      onAdded()
      onClose()
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 404 || status === 409) {
        onConflict('That plan was changed somewhere else, so the overview has been reloaded. Please try again.')
        onClose()
        return
      }
      setError(err?.response?.data?.error || "Couldn't add that. Please try again.")
      setSaving(false)
    }
  }

  const addSnippet = (s: Snippet) => add(s.id ? { snippet_id: s.id } : { type: 'custom', title: s.title })

  return (
    <div className="bottom-sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bottom-sheet-panel">
        <div className="modal-header modal-header--tight">
          <h2 className="modal-title">Add an item</h2>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close"><X size={20} /></button>
        </div>
        <p className="po-picker-sub">
          {planTitle} · {format(parseISO(planDate), 'EEE d MMM')}. Added at the end; drag it into place. Edit its
          wording in the plan builder.
        </p>

        {error && <p className="error-text">{error}</p>}

        <div className="form-field">
          <label className="settings-label">Service items</label>
          {!snippets ? (
            <p className="text-muted">Loading…</p>
          ) : (
            <div className="item-type-grid">
              {snippets.map((s, i) => (
                <button key={s.id || i} type="button" className="filter-chip" disabled={saving} onClick={() => addSnippet(s)}>
                  + {s.title}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="form-field">
          <label className="settings-label" htmlFor="po-other-title">Other</label>
          <form
            className="po-adder-row"
            onSubmit={(e) => { e.preventDefault(); if (otherTitle.trim()) add({ type: 'custom', title: otherTitle.trim() }) }}
          >
            <input
              id="po-other-title"
              type="text"
              className="input"
              placeholder="e.g. Baptism, Testimony…"
              maxLength={200}
              value={otherTitle}
              onChange={(e) => setOtherTitle(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={saving || !otherTitle.trim()}>Add</button>
          </form>
        </div>

        <div className="form-field">
          <label className="settings-label" htmlFor="po-slot-label">Song slot <span className="label-note">(label optional)</span></label>
          <form
            className="po-adder-row"
            onSubmit={(e) => { e.preventDefault(); add({ type: 'song_slot', title: slotLabel.trim() }) }}
          >
            <input
              id="po-slot-label"
              type="text"
              className="input"
              placeholder="e.g. Response song"
              maxLength={200}
              value={slotLabel}
              onChange={(e) => setSlotLabel(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={saving}>Add slot</button>
          </form>
        </div>
      </div>
    </div>
  )
}
