'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useChurch } from '@/context/ChurchContext'
import { ArrowLeft } from 'lucide-react'
import { CATEGORIES, Category, Song } from '@/types'
import { Plus, Trash2 } from 'lucide-react'
import CcliAutocomplete from '@/components/CcliAutocomplete'
import api, { setAuthToken } from '@/lib/api'
import { LyricsEditor } from '@/components/ui/LyricsEditor'
import { ArrangementBuilder } from '@/components/ui/ArrangementBuilder'
import TagInput from '@/components/ui/TagInput'

type SongLink = { id?: string; url: string; label: string; link_type: string }

const LINK_TYPES = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'spotify', label: 'Spotify' },
  { value: 'apple_music', label: 'Apple Music' },
  { value: 'other', label: 'Other' },
]

export default function EditSongPage() {
  const { id } = useParams()
  const router = useRouter()
  const { getToken } = useAuth()
  const { church } = useChurch()
  const isMasterLibrary = church?.id === process.env.NEXT_PUBLIC_MASTER_CHURCH_ID
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', author: '', default_key: '', category: '' as Category | '', first_line: '', ccli_number: '', lyrics: '', tags: '', notes: '', bible_references: '', suggested_arrangement: '', share_all_data: false, copyright_info: '', copyright_link: '' })
  const [links, setLinks] = useState<SongLink[]>([])

  const keys = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'Abm', 'Am', 'Bbm', 'Bm']

  useEffect(() => {
    if (!id) return
    api.get(`/api/songs/${id}`).then(r => {
      const s: Song = r.data
      const normaliseKey = (k: string | null | undefined) => k ? k.replace(/♯/g, '#').replace(/♭/g, 'b') : ''
      setForm({ title: s.title, author: s.author || '', default_key: normaliseKey(s.default_key), category: s.category || '', first_line: s.first_line || '', ccli_number: s.ccli_number || '', lyrics: s.lyrics || '', tags: (s.tags || []).join(', '), notes: s.notes || '', bible_references: s.bible_references || '', suggested_arrangement: s.suggested_arrangement || '', share_all_data: !!s.share_all_data, copyright_info: s.copyright_info || '', copyright_link: s.copyright_link || '' })
      setLinks((s.videos || []).map((v: any) => ({ id: v.id, url: v.url, label: v.label || '', link_type: v.link_type || 'youtube' })))
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

      // Sync links: delete removed ones, update existing, add new
      const existingLinks = links.filter(l => l.id)
      const newLinks = links.filter(l => !l.id)

      for (const link of existingLinks) {
        if (link.url.trim()) {
          await api.put(`/api/songs/${id}/videos/${link.id}`, { url: link.url, label: link.label, link_type: link.link_type })
        }
      }
      for (const link of newLinks) {
        if (link.url.trim()) {
          await api.post(`/api/songs/${id}/videos`, { url: link.url, label: link.label, link_type: link.link_type, sort_order: 0 })
        }
      }

      router.push(`/songs/${id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save changes')
      setLoading(false)
    }
  }

  const addLink = () => setLinks(l => [...l, { url: '', label: '', link_type: 'youtube' }])

  const updateLink = (i: number, field: keyof SongLink, value: string) =>
    setLinks(l => l.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const removeLink = async (i: number) => {
    const link = links[i]
    if (link.id) {
      try { await api.delete(`/api/songs/${id}/videos/${link.id}`) } catch {}
    }
    setLinks(l => l.filter((_, idx) => idx !== i))
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
          <div style={mb}><label className="label">Song title *</label>
            <CcliAutocomplete
              titleValue={form.title}
              ccliValue={form.ccli_number}
              onTitleChange={val => setForm(f => ({ ...f, title: val }))}
              onCcliChange={val => setForm(f => ({ ...f, ccli_number: val }))}
              onAuthorChange={val => setForm(f => ({ ...f, author: f.author || val }))}
              onFirstLineChange={val => setForm(f => ({ ...f, first_line: f.first_line || val }))}
              onDefaultKeyChange={val => setForm(f => ({ ...f, default_key: f.default_key || val }))}
            />
          </div>
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
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label className="label" style={{ marginBottom: 0 }}>Links</label>
                <button type="button" onClick={addLink} className="btn btn-secondary btn-sm"><Plus size={13} /> Add link</button>
              </div>
              {links.length === 0 && (
                <p className="text-muted" style={{ fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>No links added yet.</p>
              )}
              {links.map((link, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 2fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <select className="input" value={link.link_type} onChange={e => updateLink(i, 'link_type', e.target.value)}>
                    {LINK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input className="input" placeholder="Label (e.g. Live version)" value={link.label} onChange={e => updateLink(i, 'label', e.target.value)} />
                  <input className="input" placeholder="URL" value={link.url} onChange={e => updateLink(i, 'url', e.target.value)} />
                  <button type="button" onClick={() => removeLink(i)} className="btn btn-secondary btn-sm" style={{ color: '#9a3a3a' }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>
          <div style={mb}>
            <label className="label">Bible references</label>
            <input className="input" placeholder="e.g. Romans 8, Colossians 3:1-4" value={form.bible_references} onChange={e => setForm(f => ({ ...f, bible_references: e.target.value }))} />
          </div>
          <div style={mb}>
            <label className="label">Notes</label>
            <textarea className="input" rows={3} placeholder="Performance notes, tips for the band…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
          </div>
          <div style={mb}><label className="label">Tags <span className="label-note">(comma separated)</span></label><TagInput value={form.tags} onChange={v => setForm(f => ({ ...f, tags: v }))} /></div>
          <div style={mb}>
            <label className="label">Suggested arrangement</label>
            <ArrangementBuilder
              value={form.suggested_arrangement}
              onChange={val => setForm(f => ({ ...f, suggested_arrangement: val }))}
            />
          </div>
          <div style={mb}>
            <label className="label">Lyrics</label>
            {form.ccli_number && (
              <div className="text-hint" style={{ marginBottom: 8 }}>
                Find lyrics on <a href={`https://songselect.ccli.com/songs/${form.ccli_number}`} target="_blank" rel="noopener noreferrer" className="link-brand">SongSelect ↗</a>
                <span style={{ color: 'var(--color-text-muted)' }}> — CCLI {form.ccli_number}</span>
              </div>
            )}
            <LyricsEditor value={form.lyrics} onChange={v => setForm(f => ({ ...f, lyrics: v }))} />
          </div>
        <div style={mb}>
              <label className="label">Copyright</label>
              <div style={{ marginBottom: 8 }}>
                <input
                  className="input"
                  placeholder="e.g. Public domain / © 2024 Author Name. Used with permission."
                  value={form.copyright_info}
                  onChange={e => setForm(f => ({ ...f, copyright_info: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Copyright holder website <span className="label-note">(optional)</span></label>
                <input
                  className="input"
                  placeholder="https://..."
                  value={form.copyright_link}
                  onChange={e => setForm(f => ({ ...f, copyright_link: e.target.value }))}
                />
              </div>
            </div>

          {isMasterLibrary && (
            <div style={mb}>
              <label className="label">Discover sharing</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  id="share_all_data"
                  checked={form.share_all_data}
                  onChange={e => setForm(f => ({ ...f, share_all_data: e.target.checked }))}
                />
                <label htmlFor="share_all_data" style={{ fontSize: 14, cursor: 'pointer' }}>
                  Share all data — this song is public domain or we have permission from the copyright holder
                </label>
              </div>
            </div>
          )}
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