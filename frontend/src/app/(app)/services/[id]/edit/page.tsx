'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { setAuthToken } from '@/lib/api'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, X, Plus, Music, Search, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  id: string
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

// Sortable item component
function SortableItem({
  item, idx, total,
  onRemove, onUpdate, onToggleExpanded,
}: {
  item: ServiceItem
  idx: number
  total: number
  onRemove: () => void
  onUpdate: (updates: Partial<ServiceItem>) => void
  onToggleExpanded: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginBottom: 6,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px var(--space-md)' }}>

          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            style={{ cursor: 'grab', color: 'var(--color-text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', touchAction: 'none', padding: '4px 2px', userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            <GripVertical size={18} />
          </div>

          {/* Position */}
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
              </>
            ) : (
              <input
                className="input"
                value={item.title}
                onChange={e => onUpdate({ title: e.target.value })}
                placeholder={ITEM_TYPES.find(t => t.type === item.type)?.label || item.type}
                style={{ padding: '4px 8px', fontSize: 'var(--text-base)', height: 'auto' }}
              />
            )}
          </div>

          {/* Key override */}
          {item.type === 'song' && (
            <select
              value={item.key_override}
              onChange={e => onUpdate({ key_override: e.target.value })}
              style={{ padding: '4px 6px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 'var(--text-sm)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', cursor: 'pointer', width: 62, flexShrink: 0 }}
            >
              <option value="">Key</option>
              {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          )}

          {/* Category — hidden on small screens */}
          {item.type === 'song' && item.song_category && (
            <div className="hide-mobile">
              <CategoryBadge category={item.song_category as any} />
            </div>
          )}

          {/* Notes toggle */}
          <button
            type="button"
            onClick={onToggleExpanded}
            title="Add notes"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: item.notes ? 'var(--color-brand-500)' : 'var(--color-text-muted)', padding: 4, display: 'flex', flexShrink: 0 }}
          >
            {item.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {/* Remove */}
          <button
            type="button"
            onClick={onRemove}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'flex', flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Notes */}
        {item.expanded && (
          <div style={{ padding: '0 var(--space-md) var(--space-sm) 56px', borderTop: '1px solid var(--color-border)' }}>
            <input
              className="input"
              value={item.notes}
              onChange={e => onUpdate({ notes: e.target.value })}
              placeholder="Notes (e.g. Capo 2, acoustic intro…)"
              style={{ marginTop: 10, fontSize: 'var(--text-sm)', padding: '7px 12px' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function ServiceEditPage() {
  const { id } = useParams()
  const router = useRouter()
  const { loading: churchLoading } = useChurch()
  const { getToken } = useAuth()
  const [service, setService] = useState<any>(null)
  const [items, setItems] = useState<ServiceItem[]>([])
  const [songs, setSongs] = useState<Song[]>([])
  const [songSearch, setSongSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showSongPicker, setShowSongPicker] = useState(false)

  // Support both mouse and touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  )

  useEffect(() => {
    if (!id || churchLoading) return
    Promise.all([
      api.get(`/api/services/${id}`),
      api.get('/api/songs'),
    ]).then(([serviceRes, songsRes]) => {
      const s = serviceRes.data
      setService(s)
      setItems((s.items || []).map((item: any) => ({
        id: newId(),
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems(prev => {
      const oldIndex = prev.findIndex(i => i.id === active.id)
      const newIndex = prev.findIndex(i => i.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const addSong = (song: Song) => {
    setItems(prev => [...prev, {
      id: newId(), type: 'song', song_id: song.id,
      song_title: song.title, song_author: song.author,
      song_default_key: song.default_key, song_category: song.category,
      title: '', notes: '', key_override: song.default_key || '', expanded: false,
    }])
    setShowSongPicker(false)
    setSongSearch('')
  }

  const addItem = (type: string, label: string) => {
    setItems(prev => [...prev, {
      id: newId(), type, song_id: null,
      title: label, notes: '', key_override: '', expanded: false,
    }])
  }

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))
  const updateItem = (idx: number, updates: Partial<ServiceItem>) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item))
  const toggleExpanded = (idx: number) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, expanded: !item.expanded } : item))

  const handleSave = async () => {
  setSaving(true); setError('')
  try {
    const token = await getToken()
    setAuthToken(token)
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
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
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
          {/* Label and count on same line, no overlap */}
          <div style={{ position: 'relative', height: 24, marginBottom: 12, marginTop: 40 }}>
            <span style={{ position: 'absolute', left: 0, top: 0, fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
              Running order
            </span>
            <span style={{ position: 'absolute', right: 0, top: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              {items.length} item{items.length !== 1 ? 's' : ''}
            </span>
          </div>
          {items.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
              <p className="text-muted">Add songs and other items</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {items.map((item, idx) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    idx={idx}
                    total={items.length}
                    onRemove={() => removeItem(idx)}
                    onUpdate={updates => updateItem(idx, updates)}
                    onToggleExpanded={() => toggleExpanded(idx)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
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

          {/* Other items */}
          <div className="card">
            <div className="section-label">Other items</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ITEM_TYPES.map(({ type, label }) => (
                <button key={type} type="button" onClick={() => addItem(type, label)} className="filter-chip">
                  + {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed bottom save bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', padding: '12px var(--space-md)', display: 'flex', justifyContent: 'flex-end', gap: 8, zIndex: 50, boxShadow: '0 -2px 8px rgba(0,0,0,0.06)' }}>
        <Link href={`/services/${id}`} className="btn btn-secondary">Cancel</Link>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : `Save (${items.length} item${items.length !== 1 ? 's' : ''})`}
        </button>
      </div>
      <div style={{ height: 80 }} />
    </div>
  )
}
