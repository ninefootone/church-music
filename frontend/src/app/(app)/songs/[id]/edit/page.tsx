'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { ArrowLeft } from 'lucide-react'
import { CATEGORIES, Category, Song } from '@/types'
import api, { setAuthToken } from '@/lib/api'
import { LyricsEditor } from '@/components/ui/LyricsEditor'

export default function EditSongPage() {
  const { id } = useParams()
  const router = useRouter()
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', author: '', default_key: '', category: '' as Category | '', first_line: '', ccli_number: '', youtube_url: '', lyrics: '', tags: '', notes: '', bible_references: '', suggested_arrangement: '' })

  const keys = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

  useEffect(() => {
    if (!id) return
    api.get(`/api/songs/${id}`).then(r => {
      const s: Song = r.data
      setForm({ title: s.title, author: s.author || '', default_key: s.default_key || '', category: s.category || '', first_line: s.first_line || '', ccli_number: s.ccli_number || '', youtube_url: s.youtube_url || '', lyrics: s.lyrics || '', tags: (s.tags || []).join(', '), notes: s.notes || '', bible_references: s.bible_references || '', suggested_arrangement: s.suggested_arrangement || '' })
    }).catch(() => setError('Failed to load song')).finally(() => setFetching(false))
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const token = await getToken()
      setAuthToken(token)
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
      await api.put(`/api/songs/${id}`, { ...form, tags })
      router.push(`/songs/${id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save changes')
      setLoading(false)
    }
  }

  const mb: React.CSSProperties = { marginBottom: 'var(--space-md)' }

  if (fetching) return <div className="loading-state">Loading…</div>

  return (
    <div style={{ maxWidth: 'var(--width-app)', margin: '0 auto' }}>
      <Link href={`/songs/${id}`} className="back-link">
        <ArrowLeft size={13} /> Back to song
      </Link>
      <h1 className="page-title" style={{ marginBottom: 'var(--space-lg)' }}>Edit song</h1>
      {error && <div className="error-banner">{error}</div>}
      <div className="card">
        <form id="song-edit-form" onSubmit={handleSubmit}>
          <div style={mb}><label className="label">Song title *</label><input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div style={mb}><label className="label">Author(s)</label><input className="input" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', ...mb }}>
            <div>
              <label className="label">Default key</label>
              <select className="input" value={form.default_key} onChange={e => setForm(f => ({ ...f, default_key: e.target.value }))}>
                <option value="">Select key…</option>
                {keys.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}>
                <option value="">Select category…</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div style={mb}><label className="label">First line</label><input className="input" value={form.first_line} onChange={e => setForm(f => ({ ...f, first_line: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', ...mb }}>
            <div><label className="label">CCLI number</label><input className="input" value={form.ccli_number} onChange={e => setForm(f => ({ ...f, ccli_number: e.target.value }))} /></div>
            <div><label className="label">YouTube URL</label><input className="input" value={form.youtube_url} onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))} /></div>
          </div>
          <div style={mb}>
            <label className="label">Suggested arrangement</label>
            <input className="input" placeholder="e.g. Verse 1, Chorus, Verse 2, Chorus, Bridge, Chorus" value={form.suggested_arrangement} onChange={e => setForm(f => ({ ...f, suggested_arrangement: e.target.value }))} />
          </div>
          <div style={mb}>
            <label className="label">Bible references</label>
            <input className="input" placeholder="e.g. Romans 8, Colossians 3:1-4" value={form.bible_references} onChange={e => setForm(f => ({ ...f, bible_references: e.target.value }))} />
          </div>
          <div style={mb}>
            <label className="label">Notes</label>
            <textarea className="input" rows={3} placeholder="Performance notes, tips for the band…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
          </div>
          <div style={mb}><label className="label">Tags <span className="label-note">(comma separated)</span></label><input className="input" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} /></div>
          <div style={mb}>
            <label className="label">Lyrics</label>
            <LyricsEditor value={form.lyrics} onChange={v => setForm(f => ({ ...f, lyrics: v }))} />
            {form.ccli_number && (
              <div className="text-hint" style={{ marginTop: 6 }}>
                Find lyrics on <a href={`https://songselect.ccli.com/songs/${form.ccli_number}`} target="_blank" rel="noopener noreferrer" className="link-brand">SongSelect ↗</a>
              </div>
            )}
          </div>
        </form>
      </div>
      <div className="song-form-footer-spacer" />
      <div className="song-form-footer">
        <Link href={`/songs/${id}`} className="btn btn-secondary">Cancel</Link>
        <button type="submit" form="song-edit-form" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}