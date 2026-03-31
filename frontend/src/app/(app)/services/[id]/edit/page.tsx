'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, ArrowUp, ArrowDown, X, Plus, Music, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { KeyBadge, CategoryBadge } from '@/components/ui/badges'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'

const ITEM_TYPES = [
  { type: 'welcome',      label: 'Welcome' },
  { type: 'prayer',       label: 'Prayer' },
  { type: 'confession',   label: 'Confession' },
  { type: 'assurance',    label: 'Assurance' },
  { type: 'reading',      label: 'Reading' },
  { type: 'sermon',       label: 'Sermon' },
  { type: 'communion',    label: 'Communion' },
  { type: 'announcement', label: 'Announcement' },
  { type: 'custom',       label: 'Other' },
]

const KEYS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

interface ServiceItem {
  _id: string
  type: string
  song_id: string | null
  song_title?: string
  song_author?: string
  song_default_key?: string
  song_category?: string
  title: string
  notes: string
  key_override: string
  expanded: boolean
}

interface Song {
  id: string
  title: string
  author: string
  default_key: string
  category: string
}

let idCounter = 0
const newId = () => `item-${++idCounter}`

export default function ServiceEditPage() {
  const { id } = useParams()
  const router = useRouter()
  const { loading: churchLoading } = useChurch()
  const [service, setService] = useState<any>(null)
  const [items, setItems] = useState<ServiceItem[]>([])
  const [songs, setSongs] = useState<Song[]>([])
  const [songSearch, setSongSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showSongPicker, setShowSongPicker] = useState(false)

  // Desktop drag state
  const dragIndex = useRef<number | null>(null)
  const dragOverIndex = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  useEffect(() => {
    if (!id || churchLoading) return
    Promise.all([
      api.get(`/api/services/${id}`),
      api.get('/api/songs'),
    ]).then(([serviceRes, songsRes]) => {
      const s = serviceRes.data
      setService(s)
      setItems((s.items || []).map((item: any) => ({
        _id: newId(),
        type: item.type,
        song_id: item.song_id,
        song_title: item.song_title,
        song_author: item.song_author,
        song_default_key: item.song_default_key,
        song_category: item.song_category,
        title: item.title || '',
        notes: item.notes || '',
        key_override: item.key_override || '',
        expanded: false,
      })))
      setSongs(songsRes.data)
    }).catch(() => setError('Failed to load service'))
      .finally(() => setLoading(false))
  }, [id, churchLoading])

  const filteredSongs = songs.filter(s =>
    s.title.toLowerCase().includes(songSearch.toLowerCase()) ||
    s.author.toLowerCase().includes(songSearch.toLowerCase())
  )

  const addSong = (song: Song) => {
    setItems(prev => [...prev, {
      _id: newId(), type: 'song', song_id: song.id,
      song_title: song.title, song_author: song.author,
      song_default_key: song.default_key, song_category: song.category,
      title: '', notes: '', key_override: song.default_key || '', expanded: false,
    }])
    setShowSongPicker(false)
    setSongSearch('')
  }

  const addItem = (type: string, label: string) => {
    setItems(prev => [...prev, {
      _id: newId(), type, song_id: null,
      title: label, notes: '', key_override: '', expanded: false,
    }])
  }

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const updateItem = (idx: number, updates: Partial<ServiceItem>) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item))

  const toggleExpanded = (idx: number) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, expanded: !item.expanded } : item))

  // Move item up or down (works on all devices)
  const moveItem = (idx: number, direction: 'up' | 'down') => {
    const newItems = [...items]
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= newItems.length) return;
    [newItems[idx], newItems[targetIdx]] = [newItems[targetIdx], newItems[idx]]
    setItems(newItems)
  }

  // Desktop drag handlers
  const onDragStart = (idx: number) => { dragIndex.current = idx }
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    dragOverIndex.current = idx
    setDragOver(idx)
  }
  const onDragLeave = () => setDragOver(null)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(null)
    if (dragIndex.current === null || dragOverIndex.current === null) return
    if (dragIndex.current === dragOverIndex.current) return
    const newItems = [...items]
    const [moved] = newItems.splice(dragIndex.current, 1)
    newItems.splice(dragOverIndex.current, 0, moved)
    setItems(newItems)
    dragIndex.current = null
    dragOverIndex.current = null
  }

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      await api.put(`/api/services/${id}/items`, {
        items: items.map(item => ({
          type: item.type, song_id: item.song_id || null,
          title: item.title || null, notes: item.notes || null,
          key_override: item.key_override || null,
        }))
      })
      router.push(`/services/${id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save')
      setSaving(false)
    }
  }

  if (loading || churchLoading) return <p className="text-muted" style={{ padding: 'var(--space-xl)' }}>Loading…</p>
  if (!service) return <p className="text-muted" style={{ padding: 'var(--space-xl)' }}>Service not found.</p>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
        <div>
          <Link href={`/services/${id}`} className="back-link" style={{ marginBottom: 6 }}>
            <ArrowLeft size={14} /> Back to service
          </Link>
          <h1 className="page-title">
            {format(parseISO(service.service_date), 'd MMMM yyyy')}
            {service.service_time && (
              <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)', fontSize: 'var(--text-xl)' }}> · {service.service_time}</span>
            )}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={`/services/${id}`} className="btn btn-secondary">Cancel</Link>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save order'}
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="service-edit-grid">

        {/* Left — running order */}
        <div>
          <div className="section-label">
            Running order — {items.length} item{items.length !== 1 ? 's' : ''}
          </div>

          {items.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
              <p className="text-muted">Add songs and items using the panel on the right</p>
            </div>
          ) : items.map((item, idx) => (
            <div
              key={item._id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={e => onDragOver(e, idx)}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              style={{
                marginBottom: 6,
                opacity: dragOver === idx ? 0.6 : 1,
                transition: 'opacity 0.1s',
              }}
            >
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px var(--space-md)' }}>

                  {/* Up/down buttons — work on all devices */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 'up')}
                      disabled={idx === 0}
                      style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--color-border)' : 'var(--color-text-muted)', padding: '2px 4px', display: 'flex', lineHeight: 1 }}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 'down')}
                      disabled={idx === items.length - 1}
                      style={{ background: 'none', border: 'none', cursor: idx === items.length - 1 ? 'default' : 'pointer', color: idx === items.length - 1 ? 'var(--color-border)' : 'var(--color-text-muted)', padding: '2px 4px', display: 'flex', lineHeight: 1 }}
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>

                  {/* Position number */}
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', width: 20, textAlign: 'center', flexShrink: 0 }}>
                    {idx + 1}
                  </div>

                  {/* Title */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {item.type === 'song' ? (
                      <>
                        <p className="dash-row-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.song_title}
                        </p>
                        <p className="dash-row-meta">{item.song_author}</p>
                      </>
                    ) : (
                      <input
                        className="input"
                        value={item.title}
                        onChange={e => updateItem(idx, { title: e.target.value })}
                        placeholder={ITEM_TYPES.find(t => t.type === item.type)?.label || item.type}
                        style={{ padding: '4px 8px', fontSize: 'var(--text-base)', height: 'auto' }}
                      />
                    )}
                  </div>

                  {/* Key override for songs */}
                  {item.type === 'song' && (
                    <select
                      value={item.key_override}
                      onChange={e => updateItem(idx, { key_override: e.target.value })}
                      style={{ padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 'var(--text-sm)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', cursor: 'pointer', width: 68, flexShrink: 0 }}
                    >
                      <option value="">Key</option>
                      {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  )}

                  {/* Category badge — hidden on small screens */}
                  {item.type === 'song' && item.song_category && (
                    <div className="hide-mobile">
                      <CategoryBadge category={item.song_category as any} />
                    </div>
                  )}

                  {/* Notes toggle */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(idx)}
                    title="Add notes"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: item.notes ? 'var(--color-brand-500)' : 'var(--color-text-muted)', padding: 4, display: 'flex', flexShrink: 0 }}
                  >
                    {item.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'flex', flexShrink: 0 }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Notes row */}
                {item.expanded && (
                  <div style={{ padding: '0 var(--space-md) var(--space-sm) 60px', borderTop: '1px solid var(--color-border)' }}>
                    <input
                      className="input"
                      value={item.notes}
                      onChange={e => updateItem(idx, { notes: e.target.value })}
                      placeholder="Notes (e.g. Capo 2, use acoustic intro…)"
                      style={{ marginTop: 10, fontSize: 'var(--text-sm)', padding: '7px 12px' }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Right — add panel */}
        <div className="service-edit-sidebar">

          {/* Song picker */}
          <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showSongPicker ? 'var(--space-sm)' : 0 }}>
              <span className="section-label" style={{ marginBottom: 0 }}>Songs</span>
              <button
                type="button"
                onClick={() => { setShowSongPicker(!showSongPicker); setSongSearch('') }}
                className="btn btn-primary btn-sm"
              >
                <Music size={14} /> {showSongPicker ? 'Close' : 'Add song'}
              </button>
            </div>
            {showSongPicker && (
              <>
                <div style={{ position: 'relative', marginTop: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                  <input
                    className="input"
                    style={{ paddingLeft: 34 }}
                    placeholder="Search songs…"
                    value={songSearch}
                    onChange={e => setSongSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {filteredSongs.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: 'var(--text-sm)', padding: '8px 0' }}>No songs found</p>
                  ) : filteredSongs.map(song => (
                    <button
                      key={song.id}
                      type="button"
                      onClick={() => addSong(song)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 0', background: 'none', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="dash-row-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</p>
                        <p className="dash-row-meta">{song.author}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {song.default_key && <KeyBadge keyOf={song.default_key} />}
                        <Plus size={15} style={{ color: 'var(--color-brand-500)' }} />
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Other item types */}
          <div className="card">
            <div className="section-label">Other items</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ITEM_TYPES.map(({ type, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addItem(type, label)}
                  className="filter-chip"
                >
                  + {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed bottom save bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', padding: '14px var(--space-lg)', display: 'flex', justifyContent: 'flex-end', gap: 8, zIndex: 50, boxShadow: '0 -2px 8px rgba(0,0,0,0.06)' }}>
        <Link href={`/services/${id}`} className="btn btn-secondary">Cancel</Link>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : `Save running order (${items.length} item${items.length !== 1 ? 's' : ''})`}
        </button>
      </div>
      <div style={{ height: 80 }} />
    </div>
  )
}
