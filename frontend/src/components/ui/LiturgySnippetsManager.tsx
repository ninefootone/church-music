'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useChurch } from '@/context/ChurchContext'
import api, { setAuthToken } from '@/lib/api'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Plus, X, Pencil } from 'lucide-react'

interface Snippet {
  id: string
  title: string
  content: string | null
  note: string | null
  sort_order: number
}

// Settings → "Service items": manage the per-church reusable library of
// non-song service elements — a quick title on its own (Offering, Notices) or
// a title with full reusable text and a note (the Lord's Prayer, a creed).
// Admin-only surface (the whole Settings page is gated on isAdmin). Backend
// CRUD lives on /api/churches/:churchId/liturgy-snippets.
export function LiturgySnippetsManager() {
  const { getToken } = useAuth()
  const { church } = useChurch()

  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  // Editor: null = closed, 'new' = creating, otherwise the snippet id being edited.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Snippet | null>(null)

  useEffect(() => {
    if (!church || loaded) return
    api.get(`/api/churches/${church.id}/liturgy-snippets`)
      .then(r => { setSnippets(r.data); setLoaded(true) })
      .catch(() => setError('Failed to load service items.'))
  }, [church, loaded])

  async function authApi() {
    const token = await getToken()
    setAuthToken(token)
    return api
  }

  function openNew() {
    setEditingId('new'); setTitle(''); setContent(''); setNote(''); setError('')
  }
  function openEdit(s: Snippet) {
    setEditingId(s.id); setTitle(s.title); setContent(s.content || ''); setNote(s.note || ''); setError('')
  }
  function closeEditor() {
    setEditingId(null); setTitle(''); setContent(''); setNote('')
  }

  async function handleSave() {
    const t = title.trim()
    if (!t) { setError('Title is required.'); return }
    setSaving(true); setError('')
    try {
      const client = await authApi()
      const payload = { title: t, content, note }
      if (editingId === 'new') {
        const { data } = await client.post(`/api/churches/${church!.id}/liturgy-snippets`, payload)
        setSnippets(prev => [...prev, data])
      } else {
        const { data } = await client.put(`/api/churches/${church!.id}/liturgy-snippets/${editingId}`, payload)
        setSnippets(prev => prev.map(s => (s.id === editingId ? data : s)))
      }
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
      await client.delete(`/api/churches/${church!.id}/liturgy-snippets/${deleteTarget.id}`)
      setSnippets(prev => prev.filter(s => s.id !== deleteTarget.id))
    } catch {
      setError('Failed to delete.')
    } finally {
      setDeleteTarget(null)
    }
  }

  // The editor form — reused inline (editing a row) and at the foot (adding new).
  const editorForm = (
    <div className="snippet-editor">
      <label className="settings-label">Title</label>
      <input
        className="input"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="e.g. The Lord&rsquo;s Prayer"
        autoFocus
      />

      <label className="settings-label" style={{ marginTop: 12 }}>
        Content <span className="label-note">(optional)</span>
      </label>
      <RichTextEditor value={content} onChange={setContent} />

      <label className="settings-label" style={{ marginTop: 12 }}>
        Note <span className="label-note">(optional)</span>
      </label>
      <input
        className="input"
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="e.g. Congregation stands"
      />

      {error && <div className="settings-error" style={{ marginTop: 10 }}>{error}</div>}

      <div className="snippet-editor-actions">
        <button type="button" onClick={handleSave} className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : editingId === 'new' ? 'Add' : 'Save changes'}
        </button>
        <button type="button" onClick={closeEditor} className="btn btn-secondary" disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div className="settings-card settings-card--spaced">
      <h2 className="settings-section-heading settings-section-heading--tight">Service items</h2>
      <p className="settings-section-desc">
        Your church&rsquo;s reusable non-song service elements. An item can be just a title (Offering, Notices, Welcome) or a title with full text and a note — a prayer, a creed, a call to worship, communion words, a benediction. Add them once here, then pick them when building a plan.
      </p>

      {error && editingId === null && <div className="settings-error">{error}</div>}

      {loaded && snippets.length === 0 && editingId === null && (
        <p className="form-empty-note">No saved service items yet.</p>
      )}

      {snippets.length > 0 && (
        <ul className="snippet-list">
          {snippets.map(s => (
            editingId === s.id ? (
              <li key={s.id} className="snippet-editing-li">{editorForm}</li>
            ) : (
              <li key={s.id} className="snippet-row">
                <span className="snippet-row-title">{s.title}</span>
                {s.content && <span className="snippet-row-badge">text</span>}
                <div className="snippet-row-actions">
                  <button type="button" onClick={() => openEdit(s)} className="btn btn-ghost btn-icon-label" disabled={editingId !== null}>
                    <Pencil size={14} />Edit
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(s)} className="btn-icon-remove" title="Delete" disabled={editingId !== null}>
                    <X size={16} />
                  </button>
                </div>
              </li>
            )
          ))}
        </ul>
      )}

      {editingId === 'new' && editorForm}

      {editingId === null && (
        <button type="button" onClick={openNew} className="btn btn-ghost btn-icon-label snippet-add-btn">
          <Plus size={15} />Add service item
        </button>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete service item?"
          message={`“${deleteTarget.title}” will be removed from your library. Plans that already use it keep their own copy.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}