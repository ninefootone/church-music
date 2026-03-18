'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CATEGORIES, Category } from '@/types'

export default function NewSongPage() {
  const [form, setForm] = useState({
    title: '', author: '', default_key: '', category: '' as Category | '',
    first_line: '', ccli_number: '', youtube_url: '', lyrics: '', tags: '',
  })
  const [templateSearch, setTemplateSearch] = useState<null | { title: string; author: string; ccli: string }>(null)

  const keys = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']

  // Simulate template library search
  const handleTitleChange = (val: string) => {
    setForm(f => ({ ...f, title: val }))
    if (val.toLowerCase().includes('10,000') || val.toLowerCase().includes('10000')) {
      setTemplateSearch({ title: '10,000 Reasons (Bless The Lord)', author: 'Jonas Myrin, Matt Redman', ccli: '6016351' })
    } else if (val.toLowerCase().includes('in christ alone')) {
      setTemplateSearch({ title: 'In Christ Alone', author: 'Keith Getty, Stuart Townend', ccli: '3350395' })
    } else {
      setTemplateSearch(null)
    }
  }

  const importTemplate = () => {
    if (!templateSearch) return
    setForm(f => ({ ...f, title: templateSearch.title, author: templateSearch.author, ccli_number: templateSearch.ccli }))
    setTemplateSearch(null)
  }

  const inputStyle = { marginBottom: 'var(--space-md)' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <Link href="/songs" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: 'var(--space-lg)' }}>
        <ArrowLeft size={13} /> Back to songs
      </Link>

      <h1 className="page-title" style={{ marginBottom: 'var(--space-lg)' }}>Add new song</h1>

      <div className="card">

        {/* Title with template search */}
        <div style={inputStyle}>
          <label style={labelStyle}>Song title *</label>
          <input className="input" placeholder="Start typing to search the shared library…" value={form.title} onChange={e => handleTitleChange(e.target.value)} />
          {templateSearch && (
            <div style={{ marginTop: 8, padding: 'var(--space-md)', background: 'var(--color-brand-50)', border: '1px solid var(--color-brand-200)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-brand-700)', marginBottom: 4 }}>
                Found in shared library
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-brand-600)', marginBottom: 8 }}>
                {templateSearch.title} — {templateSearch.author}
              </div>
              <button onClick={importTemplate} className="btn btn-primary btn-sm">
                Import this song
              </button>
              <button onClick={() => setTemplateSearch(null)} className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }}>
                Create from scratch
              </button>
            </div>
          )}
        </div>

        <div style={inputStyle}>
          <label style={labelStyle}>Author(s) *</label>
          <input className="input" placeholder="e.g. Matt Redman" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
          <div>
            <label style={labelStyle}>Default key *</label>
            <select className="input" value={form.default_key} onChange={e => setForm(f => ({ ...f, default_key: e.target.value }))}>
              <option value="">Select key…</option>
              {keys.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Category *</label>
            <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}>
              <option value="">Select category…</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        <div style={inputStyle}>
          <label style={labelStyle}>First line</label>
          <input className="input" placeholder="Opening line of the song…" value={form.first_line} onChange={e => setForm(f => ({ ...f, first_line: e.target.value }))} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
          <div>
            <label style={labelStyle}>CCLI number</label>
            <input className="input" placeholder="e.g. 6016351" value={form.ccli_number} onChange={e => setForm(f => ({ ...f, ccli_number: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>YouTube URL</label>
            <input className="input" placeholder="https://youtube.com/…" value={form.youtube_url} onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))} />
          </div>
        </div>

        <div style={inputStyle}>
          <label style={labelStyle}>Tags</label>
          <input className="input" placeholder="Comma separated: Thanksgiving, Cross, New Wine 2025" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
        </div>

        <div style={inputStyle}>
          <label style={labelStyle}>Lyrics</label>
          <textarea className="input" rows={10} placeholder="Paste lyrics here… (tip: use SongSelect via the CCLI link)" value={form.lyrics} onChange={e => setForm(f => ({ ...f, lyrics: e.target.value }))} style={{ resize: 'vertical' }} />
          {form.ccli_number && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>
              Get lyrics from{' '}
              <a href={`https://songselect.ccli.com/songs/${form.ccli_number}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-brand-500)' }}>
                SongSelect ↗
              </a>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Link href="/songs" className="btn btn-secondary">Cancel</Link>
          <button className="btn btn-primary">Save song</button>
        </div>
      </div>
    </div>
  )
}
