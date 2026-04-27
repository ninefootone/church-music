'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import CcliAutocomplete from '@/components/CcliAutocomplete'
import { useAuth } from '@clerk/nextjs'
import { ArrowLeft } from 'lucide-react'
import { CATEGORIES, Category } from '@/types'
import api, { setAuthToken } from '@/lib/api'
import { LyricsEditor } from '@/components/ui/LyricsEditor'

export default function NewSongPage() {
  const router = useRouter()
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [templateSearch, setTemplateSearch] = useState<null | { id: string; title: string; author: string; ccli: string }>(null)
  const [copyrightDismissed, setCopyrightDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('songstack_copyright_notice_dismissed') === 'true'
  })

  const dismissCopyright = () => {
    localStorage.setItem('songstack_copyright_notice_dismissed', 'true')
    setCopyrightDismissed(true)
  }
  const [form, setForm] = useState({
    title: '', author: '', default_key: '', category: '' as Category | '',
    first_line: '', ccli_number: '', youtube_url: '', lyrics: '', tags: '',
    notes: '', bible_references: '', suggested_arrangement: '',
  })

  const keys = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

  const handleTitleChange = async (val: string) => {
    setForm(f => ({ ...f, title: val }))
    if (val.length < 3) { setTemplateSearch(null); return }
    try {
      const { data } = await api.get('/api/templates/search', { params: { q: val } })
      setTemplateSearch(data && data.length > 0 ? { id: data[0].id, title: data[0].title, author: data[0].author, ccli: data[0].ccli_number } : null)
    } catch { setTemplateSearch(null) }
  }

  const importTemplate = async () => {
    if (!templateSearch) return
    try {
      const token = await getToken()
      setAuthToken(token)
      const { data } = await api.post(`/api/templates/${templateSearch.id}/import`)
      router.push(`/songs/${data.id}`)
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to import song') }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.category) { setError('Title and category are required'); return }
    setLoading(true); setError('')
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

  return (
    <div style={{ maxWidth: 'var(--width-app)', margin: '0 auto' }}>
      <Link href="/songs" className="back-link"><ArrowLeft size={14} /> Back to songs</Link>
      <h1 className="page-title" style={{ marginBottom: 'var(--space-lg)' }}>Add new song</h1>
      {error && <div className="error-box">{error}</div>}

      {!copyrightDismissed && (
        <div className="copyright-notice">
          <div className="copyright-notice__body">
            <strong>A note on copyright</strong>
            <p>Song Stack is a planning tool. Storing complete lyrics or sheet music is only permitted if your church holds a valid <a href="https://uk.ccli.com/copyright-licences/" target="_blank" rel="noopener noreferrer" className="link-brand">CCLI Copyright Licence</a>. Music files (scores/lead sheets) require a separate <a href="https://uk.ccli.com/music-reproduction-licences/" target="_blank" rel="noopener noreferrer" className="link-brand">Music Reproduction Licence</a>. If in doubt, link to SongSelect instead of storing lyrics here.</p>
          </div>
          <button type="button" className="copyright-notice__dismiss" onClick={dismissCopyright}>
            Don't show again
          </button>
        </div>
      )}

      <div className="card">
        <form id="song-new-form" onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label className="label">Song title *</label>
            <CcliAutocomplete
              titleValue={form.title}
              ccliValue={form.ccli_number}
              onTitleChange={val => handleTitleChange(val)}
              onCcliChange={val => setForm(f => ({ ...f, ccli_number: val }))}
              onAuthorChange={val => setForm(f => ({ ...f, author: f.author || val }))}
              onFirstLineChange={val => setForm(f => ({ ...f, first_line: f.first_line || val }))}
              onDefaultKeyChange={val => setForm(f => ({ ...f, default_key: f.default_key || val }))}
            />
            {templateSearch && (
              <div style={{ marginTop: 10, padding: 'var(--space-md)', background: 'var(--color-brand-50)', border: '1px solid var(--color-brand-200)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-brand-700)', marginBottom: 4 }}>Found in shared library</div>
                <div style={{ fontSize: 15, color: 'var(--color-brand-600)', marginBottom: 10 }}>{templateSearch.title} — {templateSearch.author}</div>
                <button type="button" onClick={importTemplate} className="btn btn-primary btn-sm">Import this song</button>
                <button type="button" onClick={() => setTemplateSearch(null)} className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }}>Create from scratch</button>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label className="label">Author(s) *</label>
            <input className="input" placeholder="e.g. Matt Redman" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
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

          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label className="label">First line</label>
            <input className="input" placeholder="Opening line of the song" value={form.first_line} onChange={e => setForm(f => ({ ...f, first_line: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
            <div>
              <label className="label">CCLI number</label>
              <input className="input" placeholder="e.g. 6016351" value={form.ccli_number} onChange={e => setForm(f => ({ ...f, ccli_number: e.target.value }))} />
            </div>
            <div>
              <label className="label">YouTube URL</label>
              <input className="input" placeholder="https://youtube.com/…" value={form.youtube_url} onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label className="label">Bible references</label>
            <input className="input" placeholder="e.g. Romans 8, Colossians 3:1-4" value={form.bible_references} onChange={e => setForm(f => ({ ...f, bible_references: e.target.value }))} />
          </div>

          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label className="label">Notes</label>
            <textarea className="input" rows={3} placeholder="Performance notes, tips for the band…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
          </div>

          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label className="label">Tags <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 13 }}>(comma separated)</span></label>
            <input className="input" placeholder="God's Faithfulness, Grace, The Cross" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
          </div>

          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label className="label">Suggested arrangement</label>
            <input className="input" placeholder="e.g. Verse 1, Chorus, Verse 2, Chorus, Bridge, Chorus" value={form.suggested_arrangement} onChange={e => setForm(f => ({ ...f, suggested_arrangement: e.target.value }))} />
          </div>

          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label className="label">Lyrics</label>
            {form.ccli_number && (
              <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
                Find lyrics on <a href={`https://songselect.ccli.com/songs/${form.ccli_number}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-brand-500)' }}>SongSelect ↗</a>
                <span style={{ color: 'var(--color-text-muted)' }}> — CCLI {form.ccli_number}</span>
              </div>
            )}
            <LyricsEditor value={form.lyrics} onChange={v => setForm(f => ({ ...f, lyrics: v }))} />
          </div>
        </form>
      </div>
      <div className="song-form-footer-spacer" />
      <div className="song-form-footer">
        <Link href="/songs" className="btn btn-secondary">Cancel</Link>
        <button type="submit" form="song-new-form" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save song'}
        </button>
      </div>
    </div>
  )
}