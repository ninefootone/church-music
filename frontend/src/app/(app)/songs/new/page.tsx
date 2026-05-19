'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import CcliAutocomplete from '@/components/CcliAutocomplete'
import TagInput from '@/components/ui/TagInput'
import { useAuth } from '@clerk/nextjs'
import { useChurch } from '@/context/ChurchContext'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { CATEGORIES, Category } from '@/types'
import api, { setAuthToken } from '@/lib/api'
import { LyricsEditor } from '@/components/ui/LyricsEditor'
import { ArrangementBuilder } from '@/components/ui/ArrangementBuilder'

type SongLink = { url: string; label: string; link_type: string }

const LINK_TYPES = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'spotify', label: 'Spotify' },
  { value: 'apple_music', label: 'Apple Music' },
  { value: 'other', label: 'Other' },
]

export default function NewSongPage() {
  const router = useRouter()
  const { getToken } = useAuth()
  const { church } = useChurch()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [error])
  const [atLimit, setAtLimit] = useState(false)
  const [templateSearch, setTemplateSearch] = useState<null | { id: string; title: string; author: string; ccli: string }>(null)
  const [copyrightDismissed, setCopyrightDismissed] = useState(false)

  useEffect(() => {
    setCopyrightDismissed(localStorage.getItem('songstack_copyright_notice_dismissed') === 'true')
  }, [])

  useEffect(() => {
    if (!church) return
    const status = church.subscription_status
    if (!status || status === 'free') {
      api.get('/api/songs').then(r => {
        if (r.data.length >= 5) setAtLimit(true)
      }).catch(() => {})
    }
  }, [church])

  const dismissCopyright = () => {
    localStorage.setItem('songstack_copyright_notice_dismissed', 'true')
    setCopyrightDismissed(true)
  }
  const isMasterLibrary = church?.id === process.env.NEXT_PUBLIC_MASTER_CHURCH_ID
  const [form, setForm] = useState({
    title: '', author: '', default_key: '', category: '' as Category | '',
    first_line: '', ccli_number: '', lyrics: '', tags: [] as string[],
    notes: '', bible_references: '', suggested_arrangement: '',
    share_all_data: false, in_discover: false, discover_description: '',
    time_signature: '', tempo: '',
  })
  const [links, setLinks] = useState<SongLink[]>([])

  const addLink = () => setLinks(l => [...l, { url: '', label: '', link_type: 'youtube' }])
  const updateLink = (i: number, field: keyof SongLink, value: string) =>
    setLinks(l => l.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
  const removeLink = (i: number) => setLinks(l => l.filter((_, idx) => idx !== i))

  const keys = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'Abm', 'Am', 'Bbm', 'Bm']

  const handleTitleChange = (val: string) => {
    setForm(f => ({ ...f, title: val }))
    setTemplateSearch(null)
  }

  const handleTitleBlur = async () => {
    const val = form.title
    if (val.length < 3) return
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
      const { data } = await api.post('/api/songs', { ...form, tags: form.tags })

      for (const link of links) {
        if (link.url.trim()) {
          await api.post(`/api/songs/${data.id}/videos`, { url: link.url, label: link.label, link_type: link.link_type, sort_order: 0 })
        }
      }

      router.push(`/songs/${data.id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save song')
      setLoading(false)
    }
  }

  return (
    <div className="page-constrained">
      <Link href="/songs" className="back-link"><ArrowLeft size={14} /> Back to songs</Link>
      <h1 className="page-title page-title--tight">Add new song</h1>
      <p className="page-subtitle">Add song details below and click 'Save song'. Then you'll be able to upload files and add links.</p>
      {atLimit && (
        <div className="error-box">
          You've reached the 5 song limit on the free plan. <Link href="/settings" className="link">Upgrade in Settings</Link> to add more songs.
        </div>
      )}
      {error && <div ref={errorRef} className="error-box">{error}</div>}

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
          <div className="form-field">
            <label className="label">Song title *</label>
            <CcliAutocomplete
              titleValue={form.title}
              ccliValue={form.ccli_number}
              onTitleChange={val => handleTitleChange(val)}
              onBlur={handleTitleBlur}
              onCcliChange={val => { setForm(f => ({ ...f, ccli_number: val })); setTemplateSearch(null) }}
              onAuthorChange={val => { setForm(f => ({ ...f, author: f.author || val })); setTemplateSearch(null) }}
              onFirstLineChange={val => setForm(f => ({ ...f, first_line: f.first_line || val }))}
              onDefaultKeyChange={val => setForm(f => ({ ...f, default_key: f.default_key || val }))}
              onCategoryChange={val => setForm(f => ({ ...f, category: f.category || val as Category }))}
            />
            {templateSearch && (
              <div className="template-match">
                <div className="template-match-heading">Found in shared library</div>
                <div className="template-match-title">{templateSearch.title} — {templateSearch.author}</div>
                <div className="template-match-note">The copyright holder has given permission for this song to be shared. All fields will be copied to your library.</div>
                <div className="btn-group">
                  <button type="button" onClick={importTemplate} className="btn btn-primary btn-sm">Import this song</button>
                  <button type="button" onClick={() => setTemplateSearch(null)} className="btn btn-secondary btn-sm">Create from scratch</button>
                </div>
              </div>
            )}
          </div>

          <div className="form-field">
            <label className="label">Author(s)</label>
            <input className="input" placeholder="e.g. Matt Redman" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
          </div>

          <div className="form-grid-2 form-field">
            <div>
              <label className="label">Default key</label>
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

          <div className="form-field">
            <label className="label">First line</label>
            <input className="input" placeholder="Opening line of the song" value={form.first_line} onChange={e => setForm(f => ({ ...f, first_line: e.target.value }))} />
          </div>

          <div className="form-grid-2 form-field">
            <div>
              <label className="label">CCLI number</label>
              <input className="input" placeholder="e.g. 6016351" value={form.ccli_number} onChange={e => setForm(f => ({ ...f, ccli_number: e.target.value }))} />
            </div>
            <div className="col-span-full">
              <div className="card-header-row">
                <label className="label section-label--flush">Links</label>
                <button type="button" onClick={addLink} className="btn btn-secondary btn-sm"><Plus size={13} /> Add link</button>
              </div>
              {links.length === 0 && (
                <p className="text-muted form-empty-note">No links added yet.</p>
              )}
              {links.map((link, i) => (
                <div key={i} className="link-input-row">
                  <select className="input" value={link.link_type} onChange={e => updateLink(i, 'link_type', e.target.value)}>
                    {LINK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input className="input" placeholder="Label (e.g. Live version)" value={link.label} onChange={e => updateLink(i, 'label', e.target.value)} />
                  <input className="input" placeholder="URL" value={link.url} onChange={e => updateLink(i, 'url', e.target.value)} />
                  <button type="button" onClick={() => removeLink(i)} className="btn btn-secondary btn-sm btn-danger-text"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label className="label">Bible references</label>
            <input className="input" placeholder="e.g. Romans 8, Colossians 3:1-4" value={form.bible_references} onChange={e => setForm(f => ({ ...f, bible_references: e.target.value }))} />
          </div>

          <div className="form-field">
            <label className="label">Notes</label>
            <textarea className="input" rows={3} placeholder="Performance notes, tips for the band…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Time Signature</label>
                  <select className="input" value={form.time_signature} onChange={e => setForm(f => ({ ...f, time_signature: e.target.value }))}>
                    <option value="">— select —</option>
                    <option value="4/4">4/4</option>
                    <option value="3/4">3/4</option>
                    <option value="6/8">6/8</option>
                    <option value="12/8">12/8</option>
                    <option value="2/4">2/4</option>
                    <option value="5/4">5/4</option>
                    <option value="7/8">7/8</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Tempo (BPM)</label>
                  <input className="input" type="number" min="40" max="240" placeholder="e.g. 120" value={form.tempo} onChange={e => setForm(f => ({ ...f, tempo: e.target.value }))} />
                </div>
              </div>
          </div>

          <div className="form-field">
            <label className="label">Tags <span className="label-note">(comma separated)</span></label>
            <TagInput value={form.tags} onChange={ids => setForm(f => ({ ...f, tags: ids }))} />
          </div>

          <div className="form-field">
            <label className="label">Suggested arrangement</label>
            <ArrangementBuilder
              value={form.suggested_arrangement}
              onChange={val => setForm(f => ({ ...f, suggested_arrangement: val }))}
            />
          </div>

          <div className="form-field">
            <label className="label">Lyrics</label>
            {form.ccli_number && (
              <div className="text-hint">
                Find lyrics on <a href={`https://songselect.ccli.com/songs/${form.ccli_number}`} target="_blank" rel="noopener noreferrer" className="link-brand">SongSelect ↗</a>
                <span className="text-muted"> — CCLI {form.ccli_number}</span>
              </div>
            )}
            <LyricsEditor value={form.lyrics} onChange={v => setForm(f => ({ ...f, lyrics: v }))} />
          </div>

          {isMasterLibrary && (
            <div className="form-field">
              <label className="label">Master library</label>
              <div className="checkbox-row">
                <input
                  type="checkbox"
                  id="share_all_data"
                  checked={form.share_all_data}
                  onChange={e => setForm(f => ({ ...f, share_all_data: e.target.checked }))}
                />
                <label htmlFor="share_all_data" className="checkbox-label">
                  Share all data — this song is public domain or we have permission from the copyright holder
                </label>
              </div>
              <div className="checkbox-row" style={{ marginTop: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="in_discover"
                  checked={form.in_discover}
                  onChange={e => setForm(f => ({ ...f, in_discover: e.target.checked }))}
                />
                <label htmlFor="in_discover" className="checkbox-label">
                  Add to Discover — feature this song in the curated Discover area
                </label>
              </div>
              {form.in_discover && (
                <div style={{ marginTop: '1rem' }}>
                  <label className="label">Discover description</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="A short curator note shown in Discover, e.g. 'Great contemporary anthem, works well acoustic'"
                    value={form.discover_description}
                    onChange={e => setForm(f => ({ ...f, discover_description: e.target.value }))}
                    style={{ resize: 'vertical' }}
                  />
                  <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>Artwork can be added after saving.</p>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
      <div className="song-form-footer-spacer" />
      <div className="song-form-footer">
        <div className="btn-group">
          <Link href="/songs" className="btn btn-secondary">Cancel</Link>
          <button type="submit" form="song-new-form" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save song'}
          </button>
        </div>
      </div>
    </div>
  )
}
