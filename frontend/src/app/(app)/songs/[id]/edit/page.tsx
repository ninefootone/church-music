'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useChurch } from '@/context/ChurchContext'
import { ArrowLeft } from 'lucide-react'
import { Category, Song } from '@/types'
import CategorySelect from '@/components/ui/CategorySelect'
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
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [error])
  const [form, setForm] = useState({ title: '', author: '', default_key: '', category: '' as Category | '', first_line: '', ccli_number: '', lyrics: '', tags: [] as string[], notes: '', bible_references: '', suggested_arrangement: '', share_all_data: false, copyright_info: '', copyright_link: '', in_discover: false, discover_description: '', time_signature: '', tempo: '', is_draft: false, in_library: false })
  const [links, setLinks] = useState<SongLink[]>([])
  const [discoverImageUrl, setDiscoverImageUrl] = useState<string | null>(null)
  const [discoverImageUploading, setDiscoverImageUploading] = useState(false)

  const keys = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'Abm', 'Am', 'Bbm', 'Bm']

  useEffect(() => {
    if (!id) return
    api.get(`/api/songs/${id}`).then(r => {
      const s: Song = r.data
      const normaliseKey = (k: string | null | undefined) => k ? k.replace(/♯/g, '#').replace(/♭/g, 'b') : ''
      setForm({ title: s.title, author: s.author || '', default_key: normaliseKey(s.default_key), category: s.category || '', first_line: s.first_line || '', ccli_number: s.ccli_number || '', lyrics: s.lyrics || '',  tags: ((s.tags || []) as any[]).map((t: { id: string }) => t.id), notes: s.notes || '', bible_references: s.bible_references || '', suggested_arrangement: s.suggested_arrangement || '', share_all_data: !!s.share_all_data, copyright_info: s.copyright_info || '', copyright_link: s.copyright_link || '', in_discover: !!s.in_discover, discover_description: s.discover_description || '', time_signature: s.time_signature || '', tempo: s.tempo?.toString() || '', is_draft: !!s.is_draft, in_library: !!s.in_library })
      if (s.discover_image_key) {
        ;(async () => {
          try {
            const imgRes = await api.get(`/api/uploads/songs/${s.id}/discover-image-url`)
            setDiscoverImageUrl(imgRes.data.url)
          } catch {}
        })()
      }
      setLinks((s.videos || []).map((v: any) => ({ id: v.id, url: v.url, label: v.label || '', link_type: v.link_type || 'youtube' })))
    }).catch(() => setError('Failed to load song')).finally(() => setFetching(false))
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.category) { setError('Title and category are required'); return }
    setLoading(true); setError('')
    try {
      const token = await getToken()
      setAuthToken(token)
      await api.put(`/api/songs/${id}`, { ...form, tags: form.tags })

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

  const handleDiscoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setDiscoverImageUploading(true)
    try {
      const token = await getToken()
      setAuthToken(token)
      const formData = new FormData()
      formData.append('image', file)
      const res = await api.post(`/api/uploads/songs/${id}/discover-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setDiscoverImageUrl(res.data.url)
    } catch {
      setError('Failed to upload image')
    } finally {
      setDiscoverImageUploading(false)
    }
  }

  const handleDiscoverImageDelete = async () => {
    try {
      const token = await getToken()
      setAuthToken(token)
      await api.delete(`/api/uploads/songs/${id}/discover-image`)
      setDiscoverImageUrl(null)
    } catch {
      setError('Failed to remove image')
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

  if (fetching) return <div className="loading-state">Loading…</div>

  return (
    <div className="page-constrained">
      <Link href={`/songs/${id}`} className="back-link">
        <ArrowLeft size={13} /> Back to song
      </Link>
      <h1 className="page-title page-title--spaced">Edit song</h1>
      {error && <div ref={errorRef} className="error-box">{error}</div>}
      <div className="card">
        <form id="song-edit-form" onSubmit={handleSubmit}>
          {isMasterLibrary && (
            <div className="form-field">
              <label className="label">Master library</label>
              <div className="checkbox-row">
                <input type="checkbox" id="is_draft" checked={form.is_draft} onChange={e => setForm(f => ({ ...f, is_draft: e.target.checked }))} />
                <label htmlFor="is_draft" className="checkbox-label">Draft — hide from public library until reviewed</label>
              </div>
              <div className="checkbox-row" style={{ marginTop: '0.5rem' }}>
                <input type="checkbox" id="in_library" checked={form.in_library} onChange={e => setForm(f => ({ ...f, in_library: e.target.checked }))} />
                <label htmlFor="in_library" className="checkbox-label">Add to public library — show this song in the searchable Discover library</label>
              </div>
              <div className="checkbox-row" style={{ marginTop: '0.5rem' }}>
                <input type="checkbox" id="share_all_data" checked={form.share_all_data} onChange={e => setForm(f => ({ ...f, share_all_data: e.target.checked }))} />
                <label htmlFor="share_all_data" className="checkbox-label">Share all data — this song is public domain or we have permission from the copyright holder</label>
              </div>
            </div>
          )}
          <div className="form-field"><label className="label">Song title *</label>
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
          <div className="form-field"><label className="label">Author(s)</label><input className="input" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} /></div>
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
              <CategorySelect value={form.category} onChange={val => setForm(f => ({ ...f, category: val as Category }))} />
            </div>
          </div>
          <div className="form-field"><label className="label">First line</label><input className="input" value={form.first_line} onChange={e => setForm(f => ({ ...f, first_line: e.target.value }))} /></div>
          <div className="form-field"><label className="label">CCLI number</label><input className="input" value={form.ccli_number} onChange={e => setForm(f => ({ ...f, ccli_number: e.target.value }))} /></div>
          <div className="form-field">
            <label className="label">Bible references</label>
            <input className="input" placeholder="e.g. Romans 8, Colossians 3:1-4" value={form.bible_references} onChange={e => setForm(f => ({ ...f, bible_references: e.target.value }))} />
          </div>
          <div className="form-field">
            <label className="label">Notes</label>
            <textarea className="input" rows={3} placeholder="Performance notes, tips for the band…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
              <div className="form-timing-grid" style={{ marginTop: '1rem' }}>
                <div>
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
                <div>
                  <label className="label">Tempo (BPM)</label>
                  <input className="input" type="number" min="40" max="240" placeholder="e.g. 120" value={form.tempo} onChange={e => setForm(f => ({ ...f, tempo: e.target.value }))} />
                </div>
              </div>
          </div>
          <div className="form-field"><label className="label">Tags</label><TagInput value={form.tags} onChange={ids => setForm(f => ({ ...f, tags: ids }))} /></div>
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
        <div className="form-field">
              <label className="label">Copyright</label>
              <div className="form-subfield">
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
            <div className="form-field">
              <div className="checkbox-row">
                <input
                  type="checkbox"
                  id="in_discover"
                  checked={form.in_discover}
                  onChange={e => setForm(f => ({ ...f, in_discover: e.target.checked }))}
                />
                <label htmlFor="in_discover" className="checkbox-label">
                  Add to Discover — feature this song in the curated Discover carousel
                </label>
              </div>
              {form.in_discover && (
                <div style={{ marginTop: '1rem' }}>
                  <div className="form-subfield">
                    <label className="label">Discover description</label>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="A short curator note shown in Discover, e.g. 'Great contemporary anthem, works well acoustic'"
                      value={form.discover_description}
                      onChange={e => setForm(f => ({ ...f, discover_description: e.target.value }))}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                  <div className="form-subfield" style={{ marginTop: '0.75rem' }}>
                    <label className="label">Discover artwork <span className="label-note">(square image, JPG/PNG/WebP, max 5MB)</span></label>
                    {discoverImageUrl && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <img src={discoverImageUrl} alt="Discover artwork" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, display: 'block', marginBottom: '0.5rem' }} />
                        <button type="button" className="btn btn-secondary btn-sm btn-danger-text" onClick={handleDiscoverImageDelete}>
                          <Trash2 size={13} /> Remove image
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleDiscoverImageUpload}
                      disabled={discoverImageUploading}
                      style={{ marginTop: discoverImageUrl ? '0.5rem' : 0 }}
                    />
                    {discoverImageUploading && <p className="text-muted" style={{ marginTop: '0.25rem' }}>Uploading…</p>}
                  </div>
                </div>
              )}
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
