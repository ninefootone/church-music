'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { ArrowLeft } from 'lucide-react'
import { CATEGORIES, Category } from '@/types'
import api, { setAuthToken } from '@/lib/api'
import { useChurch } from '@/context/ChurchContext'

export default function NewSongPage() {
  const router = useRouter()
  const { getToken } = useAuth()
  const { church } = useChurch()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [templateSearch, setTemplateSearch] = useState<null | { id: string; title: string; author: string; ccli: string }>(null)
  const [form, setForm] = useState({
    title: '', author: '', default_key: '', category: '' as Category | '',
    first_line: '', ccli_number: '', youtube_url: '', lyrics: '', tags: '',
  })

  const keys = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

  const handleTitleChange = async (val: string) => {
    setForm(f => ({ ...f, title: val }))
    if (val.length < 3) { setTemplateSearch(null); return }
    try {
      const { data } = await api.get('/api/templates/search', { params: { q: val } })
      if (data && data.length > 0) {
        setTemplateSearch({ id: data[0].id, title: data[0].title, author: data[0].author, ccli: data[0].ccli_number })
      } else {
        setTemplateSearch(null)
      }
    } catch { setTemplateSearch(null) }
  }

  const importTemplate = async () => {
    if (!templateSearch) return
    try {
      const token = await getToken()
      setAuthToken(token)
      const { data } = await api.post(`/api/templates/${templateSearch.id}/import`)
      router.push(`/songs/${data.id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to import song')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.category) { setError('Title and category are required'); return }
    setLoading(true)
    setError('')
    try {
      const token = await getToken()
      setAuthToken(token)
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
      const { data } = await api.post('/api/songs', { ...form, tags })
      router.push(`/songs/${data.id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save song')
      setLoading(false)
    }
  }

  const mb: React.CSSProperties = { marginBottom: 'var(--space-md)' }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <Link href="/songs" className="back-link">
        <ArrowLeft size={13} /> Back to songs
      </Link>
      <h1 className="page-title" style={{ marginBottom: 'var(--space-lg)' }}>Add new song</h1>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div style={mb}>
            <label className="label">Song title *</label>
            <input className="input" placeholder="Start typing to search the shared library…" value={form.title} onChange={e => handleTitleChange(e.target.value)} />
            {templateSearch && (
              <div style={{ marginTop: 8, padding: 'var(--space-md)', background: 'var(--color-brand-50)', border: '1px solid var(--color-brand-200)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ marginBottom: 4, fontWeight: 600, color: 'var(--color-brand-700)' }} className="text-hint">Found in shared library</div>
                <div className="text-hint" style={{ color: 'var(--color-brand-600)', marginBottom: 8 }}>{templateSearch.title} — {templateSearch.author}</div>
                <button type="button" onClick={importTemplate} className="btn btn-primary btn-sm">Import this song</button>
                <button type="button" onClick={() => setTemplateSearch(null)} className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }}>Create from scratch</button>
              </div>
            )}
          </div>

          <div style={mb}>
            <label className="label">Author(s) *</label>
            <input className="input" placeholder="e.g. Matt Redman" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', ...mb }}>
            <div>
              <label className="label">Default key *</label>
              <select className="input" value={form.default_key} onChange={e => setForm(f => ({ ...f, default_key: e.target.value }))}>
                <option value="">Select key…</option>
                {keys.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Category *</label>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}>
                <option value="">Select category…</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div style={mb}>
            <label className="label">First line</label>
            <input className="input" placeholder="Opening line of the song" value={form.first_line} onChange={e => setForm(f => ({ ...f, first_line: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', ...mb }}>
            <div>
              <label className="label">CCLI number</label>
              <input className="input" placeholder="e.g. 6016351" value={form.ccli_number} onChange={e => setForm(f => ({ ...f, ccli_number: e.target.value }))} />
            </div>
            <div>
              <label className="label">YouTube URL</label>
              <input className="input" placeholder="https://youtube.com/…" value={form.youtube_url} onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))} />
            </div>
          </div>

          <div style={mb}>
            <label className="label">Tags <span className="label-note">(comma separated)</span></label>
            <input className="input" placeholder="Thanksgiving, Cross, New Wine 2025" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
          </div>

          <div style={mb}>
            <label className="label">Lyrics</label>
            <textarea className="input" rows={10} placeholder="Paste lyrics here…" value={form.lyrics} onChange={e => setForm(f => ({ ...f, lyrics: e.target.value }))} style={{ resize: 'vertical' }} />
            {form.ccli_number && (
              <div className="text-hint" style={{ marginTop: 6 }}>
                Find lyrics on <a href={`https://songselect.ccli.com/songs/${form.ccli_number}`} target="_blank" rel="noopener noreferrer" className="link-brand">SongSelect ↗</a>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Link href="/songs" className="btn btn-secondary">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save song'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
