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
import { ArrangementBuilder } from '@/components/ui/ArrangementBuilder'

const DEFAULT_ITEM_TYPES = [
  { label: 'Welcome' },
  { label: 'Prayer' },
  { label: 'Confession' },
  { label: 'Assurance' },
  { label: 'Reading' },
  { label: 'Sermon' },
  { label: 'Communion' },
  { label: 'Announcement' },
]

const KEYS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'Abm', 'Am', 'Bbm', 'Bm']

function normaliseKey(key: string | null | undefined): string {
  if (!key) return ''
  return key
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#')
    .trim();
}

interface PlanItem {
  id: string
  type: string
  phase: 'pre_service' | 'service'
  song_id: string | null
  song_title?: string
  song_author?: string
  song_default_key?: string
  song_category?: string
  song_suggested_arrangement?: string
  song_default_duration?: number | null
  title: string
  notes: string
  key_override: string
  custom_arrangement: string
  expanded: boolean
  duration_minutes: number | null
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
  showTimings, showDurations, calculatedStart,
}: {
  item: PlanItem
  idx: number
  total: number
  onRemove: () => void
  onUpdate: (updates: Partial<PlanItem>) => void
  onToggleExpanded: () => void
  showTimings: boolean
  showDurations: boolean
  calculatedStart: string | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style = {
    transform: isDragging ? CSS.Transform.toString(transform) : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginBottom: 6,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div className="card card--flush">
        {(showTimings || showDurations) && (
          <div className="item-timing-row">
            {showTimings && calculatedStart && (
              <span className="item-timing-time">{calculatedStart}</span>
            )}
            {showDurations && (
              <span className="item-timing-duration">
                <input
                  type="number"
                  min="1"
                  max="180"
                  placeholder="mins"
                  value={item.duration_minutes ?? ''}
                  onChange={e => onUpdate({ duration_minutes: e.target.value ? parseInt(e.target.value) : null })}
                  className="duration-input"
                />
              </span>
            )}
          </div>
        )}
        <div className="sortable-item-row">

          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            style={{ cursor: 'grab', color: 'var(--color-text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', touchAction: 'none', padding: '4px 2px', userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            <GripVertical size={18} />
          </div>

          {/* Position */}
          <div className="item-index">
            {idx + 1}
          </div>

          {/* Title */}
          <div className="dash-row-content">
            {item.type === 'song' ? (
              <>
                <p className="dash-row-title">
                  {item.song_title}
                </p>
              </>
            ) : (
              <input
                className="input input--sm"
                value={item.title}
                onChange={e => onUpdate({ title: e.target.value })}
                placeholder={item.title || 'Item title'}
              />
            )}
          </div>

          {/* Key override */}
          {item.type === 'song' && (
            <select
              value={item.key_override}
              onChange={e => onUpdate({ key_override: e.target.value })}
              className="key-select"
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
            className="btn-icon-toggle"
            style={{ color: item.notes ? 'var(--color-brand-500)' : 'var(--color-text-muted)' }}
          >
            {item.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {/* Remove */}
          <button
            type="button"
            onClick={onRemove}
            className="btn-icon-remove"
          >
            <X size={16} />
          </button>
        </div>

        {/* Notes + arrangement */}
        {item.expanded && (
          <div className="item-notes-panel">
                        <textarea
              className="input notes-input"
              value={item.notes}
              onChange={e => onUpdate({ notes: e.target.value })}
              placeholder="Notes (e.g. Capo 2, acoustic intro…)"
              rows={3}
              onKeyDown={e => {
                const el = e.currentTarget
                const start = el.selectionStart ?? 0
                const end = el.selectionEnd ?? 0
                if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
                  e.preventDefault()
                  const selected = el.value.slice(start, end)
                  const wrapped = `**${selected}**`
                  const next = el.value.slice(0, start) + wrapped + el.value.slice(end)
                  onUpdate({ notes: next })
                  const newCursor = start + wrapped.length
                  requestAnimationFrame(() => { el.selectionStart = selected ? newCursor : start + 2; el.selectionEnd = selected ? newCursor : start + 2 })
                }
                if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
                  e.preventDefault()
                  const selected = el.value.slice(start, end)
                  const wrapped = `_${selected}_`
                  const next = el.value.slice(0, start) + wrapped + el.value.slice(end)
                  onUpdate({ notes: next })
                  const newCursor = start + wrapped.length
                  requestAnimationFrame(() => { el.selectionStart = selected ? newCursor : start + 1; el.selectionEnd = selected ? newCursor : start + 1 })
                }
              }}
            />
            {item.type === 'song' && (
              <div>
                <p className="sub-section-label">
                  Arrangement for this plan
                </p>
                <ArrangementBuilder
                  value={item.custom_arrangement || item.song_suggested_arrangement || ''}
                  onChange={val => onUpdate({ custom_arrangement: val })}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PlanEditPage() {
  const { id } = useParams()
  const router = useRouter()
  const { church, loading: churchLoading } = useChurch()
  const { getToken } = useAuth()
  const [plan, setPlan] = useState<any>(null)
  const [customItemTypes, setCustomItemTypes] = useState<{ label: string }[] | null>(null)
  const [items, setItems] = useState<PlanItem[]>([])
  const [songs, setSongs] = useState<Song[]>([])
  const [songSearch, setSongSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [planStatus, setPlanStatus] = useState<'draft' | 'published'>('published')
  const [showSongPicker, setShowSongPicker] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [showTimings, setShowTimings] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('plan_show_timings') === 'true'
  })
  const [showDurations, setShowDurations] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('plan_show_durations') === 'true'
  })

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 940)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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
    if (!id || churchLoading || !church) return
    Promise.all([
      api.get(`/api/plans/${id}`),
      api.get('/api/songs', { params: { include_retired: 'false' } }),
      api.get(`/api/churches/${church.id}/plan-item-types`),
    ]).then(([planRes, songsRes, itemTypesRes]) => {
      if (itemTypesRes.data.length > 0) {
        setCustomItemTypes(itemTypesRes.data.map((t: { name: string }) => ({ label: t.name })))
      }
      const s = planRes.data
      setPlan(s)
      setPlanStatus(s.status ?? 'published')
      setItems((s.items || []).map((item: any) => ({
        id: newId(),
        type: item.type,
        song_id: item.song_id,
        song_title: item.song_title,
        song_author: item.song_author,
        song_default_key: item.song_default_key,
        song_category: item.song_category,
        song_default_duration: item.song_default_duration ?? null,
        title: item.title || '',
        notes: item.notes || '',
        key_override: normaliseKey(item.key_override) || normaliseKey(item.song_default_key),
        custom_arrangement: item.custom_arrangement || '',
        song_suggested_arrangement: item.song_suggested_arrangement || '',
        expanded: false,
        phase: item.phase || 'service',
        duration_minutes: item.duration_minutes ?? item.song_default_duration ?? null,
      })))
      setSongs(songsRes.data)
    }).catch(() => setError('Failed to load plan'))
      .finally(() => setLoading(false))
  }, [id, churchLoading, church])

  const filteredSongs = songs.filter(s =>
    s.title.toLowerCase().includes(songSearch.toLowerCase()) ||
    s.author.toLowerCase().includes(songSearch.toLowerCase())
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    if (active.id === DIVIDER_ID) return // divider is not draggable
    setItems(prev => {
      const oldIndex = prev.findIndex(i => i.id === active.id)
      const newIndex = prev.findIndex(i => i.id === over.id)
      const reordered = arrayMove(prev, oldIndex, newIndex)
      // Determine phase based on position relative to divider
      const dividerIndex = reordered.findIndex(i => i.id === DIVIDER_ID)
      return reordered.map((item, idx) => {
        if (item.id === DIVIDER_ID) return item
        return { ...item, phase: dividerIndex === -1 || idx >= dividerIndex ? 'service' : 'pre_service' }
      })
    })
  }

  const addSong = (song: Song) => {
    setItems(prev => [...prev, {
      id: newId(), type: 'song', song_id: song.id,
      song_title: song.title, song_author: song.author,
      song_default_key: song.default_key, song_category: song.category,
      song_suggested_arrangement: (song as any).suggested_arrangement || '',
      song_default_duration: (song as any).default_duration ?? null,
      title: '', notes: '', key_override: normaliseKey(song.default_key),
      custom_arrangement: '', expanded: false,
      phase: 'service',
      duration_minutes: (song as any).default_duration ?? null,
    }])
    setSongSearch('')
  }

  const addItem = (type: string, label: string) => {
    setItems(prev => [...prev, {
      id: newId(), type, song_id: null,
      title: label, notes: '', key_override: '', custom_arrangement: '', expanded: false,
      phase: 'service',
      duration_minutes: null,
    }])
  }

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))
  const updateItem = (idx: number, updates: Partial<PlanItem>) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item))
  const toggleExpanded = (idx: number) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, expanded: !item.expanded } : item))

  const handleSave = async (status: 'draft' | 'published') => {
    setSaving(true); setError('')
    try {
      const token = await getToken()
      setAuthToken(token)
      await Promise.all([
        api.put(`/api/plans/${id}/items`, {
          items: allItems.filter(item => item.id !== DIVIDER_ID).map(item => ({
            type: item.type, song_id: item.song_id || null,
            title: item.title || null, notes: item.notes || null,
            key_override: item.key_override || null,
            custom_arrangement: item.custom_arrangement || null,
            duration_minutes: item.duration_minutes || null,
            phase: item.phase || 'service',
          }))
        }),
        api.put(`/api/plans/${id}`, {
          plan_date: plan.plan_date,
          plan_time: plan.plan_time,
          plan_start_time: plan.plan_start_time,
          plan_sort_order: plan.plan_sort_order ?? 0,
          title: plan.title,
          status,
        }),
      ])
      router.push(`/plans/${id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save')
      setSaving(false)
    }
  }

  if (loading || churchLoading) return <p className="text-muted dash-loading">Loading…</p>
  if (!plan) return <p className="text-muted dash-loading">Plan not found.</p>

  const DIVIDER_ID = 'divider--start'
  const planStartTime = plan.plan_start_time ? plan.plan_start_time.slice(0, 5) : null

  const allItems: PlanItem[] = planStartTime
    ? (() => {
        const dividerIndex = items.findIndex(i => i.id === DIVIDER_ID)
        if (dividerIndex !== -1) return items
        // inject divider between pre_service and service items if not already present
        const firstService = items.findIndex(i => i.phase === 'service')
        const insertAt = firstService === -1 ? items.length : firstService
        return [
          ...items.slice(0, insertAt),
          { id: DIVIDER_ID, type: 'divider', phase: 'service', song_id: null, title: '', notes: '', key_override: '', custom_arrangement: '', expanded: false, duration_minutes: null },
          ...items.slice(insertAt),
        ]
      })()
    : items

  function calcStartTimes(): (string | null)[] {
    if (!planStartTime) return allItems.map(() => null)
    let [h, m] = planStartTime.split(':').map(Number)
    let counting = false
    return allItems.map(item => {
      if (item.id === DIVIDER_ID) { counting = true; return null }
      if (!counting) return null
      const label = `${h}:${String(m).padStart(2, '0')}`
      const dur = item.duration_minutes ?? 0
      m += dur
      h += Math.floor(m / 60)
      m = m % 60
      return label
    })
  }
  const startTimes = calcStartTimes()

  return (
    <div>
      {/* Header */}
      <div className="plan-edit-header">
        <div>
          <Link href={`/plans/${id}`} className="back-link back-link--spaced">
            <ArrowLeft size={14} /> Back to plan
          </Link>
          <h1 className="page-title">
            {format(parseISO(plan.plan_date), 'd MMMM yyyy')}
            {(plan.plan_start_time || plan.plan_time) && (
              <span className="page-title-meta"> · {plan.plan_start_time ? new Date(`1970-01-01T${plan.plan_start_time}`).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }) : plan.plan_time}</span>
            )}
          </h1>
          <Link href={`/plans/${id}/settings`} className="edit-details-link">
            Edit details ↗
          </Link>
          <div className="timing-toggles">
            <label className="timing-toggle-label">
              <input type="checkbox" checked={showTimings} onChange={e => {
                setShowTimings(e.target.checked)
                localStorage.setItem('plan_show_timings', String(e.target.checked))
              }} disabled={!planStartTime} title={!planStartTime ? 'Set a start time in plan settings first' : ''} /> Show timings
            </label>
            <label className="timing-toggle-label">
              <input type="checkbox" checked={showDurations} onChange={e => {
                setShowDurations(e.target.checked)
                localStorage.setItem('plan_show_durations', String(e.target.checked))
              }} /> Show item duration
            </label>
          </div>
        </div>
        <div className="btn-group">
          <Link href={`/plans/${id}`} className="btn btn-secondary">Cancel</Link>
          <button className="btn btn-secondary" onClick={() => handleSave('draft')} disabled={saving}>
            {saving ? 'Saving…' : planStatus === 'published' ? 'Revert to draft' : 'Save draft'}
          </button>
          <button className="btn btn-primary" onClick={() => handleSave('published')} disabled={saving}>
            {saving ? 'Saving…' : 'Publish'}
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="plan-edit-grid">

        {/* Sidebar rendered above running order on mobile via isMobile, right column on desktop */}
        {isMobile && (
          <div className="plan-edit-sidebar">
            {/* Song picker */}
            <div className="card card--spaced">
              <span className="section-label">Songs</span>
              <>
                  <div className="songs-search-wrap">
                    <Search size={14} className="songs-search-icon" />
                    <input
                      className="input songs-search-input"
                      placeholder="Search songs…"
                      value={songSearch}
                      onChange={e => setSongSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="song-picker-list">
                    {!songSearch ? (
                      <p className="text-muted picker-empty">Type to search songs</p>
                    ) : filteredSongs.length === 0 ? (
                      <p className="text-muted picker-empty">No songs found</p>
                    ) : filteredSongs.map(song => (
                      <button
                        key={song.id}
                        type="button"
                        onClick={() => addSong(song)}
                        className="song-picker-btn"
                      >
                        <div className="dash-row-content">
                          <p className="dash-row-title">{song.title}</p>
                        </div>
                        <div className="song-picker-btn-right">
                          {song.default_key && <KeyBadge keyOf={song.default_key} />}
                          <Plus size={15} className="text-brand" />
                        </div>
                      </button>
                    ))}
                </div>
              </>
            </div>

            {/* Other items */}
            <div className="card">
              <div className="section-label">Other items</div>
              <div className="item-type-grid">
                {(customItemTypes ?? DEFAULT_ITEM_TYPES).map(({ label }) => (
                  <button key={label} type="button" onClick={() => addItem('custom', label)} className="filter-chip">
                    + {label}
                  </button>
                ))}
                <button type="button" onClick={() => addItem('custom', '')} className="filter-chip">
                  + Other
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right — add panel (desktop only, mobile rendered above) */}
        {!isMobile && (
          <div className="plan-edit-sidebar">
            {/* Song picker */}
            <div className="card card--spaced">
              <span className="section-label">Songs</span>
              <>
                  <div className="songs-search-wrap">
                    <Search size={14} className="songs-search-icon" />
                    <input
                      className="input songs-search-input"
                      placeholder="Search songs…"
                      value={songSearch}
                      onChange={e => setSongSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="song-picker-list">
                    {filteredSongs.length === 0 ? (
                      <p className="text-muted picker-empty">No songs found</p>
                    ) : filteredSongs.map(song => (
                      <button
                        key={song.id}
                        type="button"
                        onClick={() => addSong(song)}
                        className="song-picker-btn"
                      >
                        <div className="dash-row-content">
                          <p className="dash-row-title">{song.title}</p>
                        </div>
                        <div className="song-picker-btn-right">
                          {song.default_key && <KeyBadge keyOf={song.default_key} />}
                          <Plus size={15} className="text-brand" />
                        </div>
                      </button>
                    ))}
                </div>
              </>
            </div>

            {/* Other items */}
            <div className="card">
              <div className="section-label">Other items</div>
              <div className="item-type-grid">
                {(customItemTypes ?? DEFAULT_ITEM_TYPES).map(({ label }) => (
                  <button key={label} type="button" onClick={() => addItem('custom', label)} className="filter-chip">
                    + {label}
                  </button>
                ))}
                <button type="button" onClick={() => addItem('custom', '')} className="filter-chip">
                  + Other
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Left — running order */}
        <div className="running-order-col">
          {/* Label and count on same line, no overlap */}
          <div className="section-header-row">
            <span className="running-order-label">
              Running order
            </span>
            <span className="running-order-count">
              {items.length} item{items.length !== 1 ? 's' : ''}
            </span>
          </div>
          {items.length === 0 ? (
            <div className="card card-empty">
              <p className="text-muted">Add songs and other items</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={allItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {allItems.map((item, idx) => {
                  if (item.id === DIVIDER_ID) {
                    return (
                      <div key={DIVIDER_ID} className="plan-divider">
                        <div className="plan-divider-line" />
                        <span className="plan-divider-label">
                          {new Date(`1970-01-01T${planStartTime}`).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                        <div className="plan-divider-line" />
                      </div>
                    )
                  }
                  const realIdx = allItems.slice(0, idx).filter(i => i.id !== DIVIDER_ID).length
                  return (
                    <SortableItem
                      key={item.id}
                      item={item}
                      idx={realIdx}
                      total={items.length}
                      onRemove={() => removeItem(realIdx)}
                      onUpdate={updates => updateItem(realIdx, updates)}
                      onToggleExpanded={() => toggleExpanded(realIdx)}
                      showTimings={showTimings && !!planStartTime && item.phase === 'service'}
                      showDurations={showDurations}
                      calculatedStart={startTimes[idx]}
                    />
                  )
                })}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Fixed bottom save bar */}
      <div className="save-bar">
        <Link href={`/plans/${id}`} className="btn btn-secondary">Cancel</Link>
        <button className="btn btn-secondary" onClick={() => handleSave('draft')} disabled={saving}>
          {saving ? 'Saving…' : planStatus === 'published' ? 'Revert to draft' : 'Save draft'}
        </button>
        <button className="btn btn-primary" onClick={() => handleSave('published')} disabled={saving}>
          {saving ? 'Saving…' : 'Publish'}
        </button>
      </div>
      <div className="save-bar-spacer" />
    </div>
  )
}
