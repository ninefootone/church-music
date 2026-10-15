'use client'

// Plans → Overview (/plans/overview): several upcoming plans side by side, so songs and rotas
// can be chosen with the weeks around them in view (see project doc plans-overview.md).
// Musicians can be added, changed and removed here, and songs added, chosen for a slot, swapped,
// removed and every item dragged into a new order within its plan — always via the single-item
// routes (reorder: PUT /items/order, 409 if the plan changed elsewhere), never the whole-list PUT /items. Other items
// (readings, prayers, rich content), keys and arrangements are edited in the normal plan builder.
// Data: GET /api/plans/overview (planners only, drafts included).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, AlertTriangle, X, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import api from '@/lib/api'
import { useChurch } from '@/context/ChurchContext'
import { KeyBadge } from '@/components/ui/badges'
import { isSongSlot, nonSongLabel } from '@/lib/planItems'
import { PlanMusicianModal, type ExistingMusician } from '@/components/ui/PlanMusicianModal'
import { OverviewSongPicker, type SongPickerMode } from '@/components/ui/OverviewSongPicker'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface OverviewItem {
  id: string
  type: string
  phase: string | null
  title: string | null
  position: number
  key_override: string | null
  duration_minutes: number | null
  song_id: string | null
  song_title: string | null
  song_default_key: string | null
  song_default_duration: number | null
}

interface OverviewMusician {
  id: string
  name: string
  role: string | null
  user_id: string | null
}

interface OverviewPlan {
  id: string
  title: string | null
  status: 'draft' | 'published'
  plan_date: string
  plan_time: string | null
  items: OverviewItem[]
  musicians: OverviewMusician[]
}

interface SongUse {
  song_id: string
  plan_id: string
  plan_date: string
  title: string | null
}

interface Unavailability {
  user_id: string
  start_date: string
  end_date: string
  note: string | null
}

interface OverviewData {
  repeat_window_days: number
  has_previous: boolean
  has_next: boolean
  plans: OverviewPlan[]
  song_uses: SongUse[]
  unavailability: Unavailability[]
}

const COUNTS = [3, 4, 5, 6]
// Literal class names (not built from strings) so the CSS is easy to find.
const colsClass: Record<number, string> = { 3: 'po-grid po-cols-3', 4: 'po-grid po-cols-4', 5: 'po-grid po-cols-5', 6: 'po-grid po-cols-6' }
const COUNT_KEY = 'plansOverview.count'
const REPEAT_KEY = 'plansOverview.repeatWeeks'
const REPEAT_OPTIONS = [2, 4, 6, 8, 12]
const SHOW_KEY = 'plansOverview.show'

function readStored<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // private window / blocked storage — the page still works, it just won't remember
  }
}

const shortDate = (d: string) => format(parseISO(d), 'd MMM')

// One line per person: someone singing, on keys and leading is three plan_musicians rows.
// Grouped by member id, or by name for guests who aren't signed up.
// `rows` keeps every underlying row (id + role) so the person can be changed or removed as a whole.
type GroupedMusician = OverviewMusician & { roles: string[]; rows: { id: string; role: string }[] }
function groupMusicians(list: OverviewMusician[]) {
  const out: GroupedMusician[] = []
  const byKey = new Map<string, GroupedMusician>()
  for (const m of list) {
    const key = m.user_id || `name:${m.name.trim().toLowerCase()}`
    let e = byKey.get(key)
    if (!e) {
      e = { ...m, roles: [], rows: [] }
      byKey.set(key, e)
      out.push(e)
    }
    e.rows.push({ id: m.id, role: m.role || '' })
    if (m.role && !e.roles.includes(m.role)) e.roles.push(m.role)
  }
  return out
}

// One draggable row. Only the grip starts a drag, so clicking a song title still opens the picker.
function SortableRow({ id, className, disabled, children }: { id: string; className: string; disabled: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${className} po-sortable${isDragging ? ' po-dragging' : ''}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="po-drag-handle"
        aria-label="Drag to reorder"
        title="Drag to reorder"
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={12} />
      </button>
      <div className="po-item-body">{children}</div>
    </li>
  )
}

function agoLabel(days: number) {
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  const w = Math.round(days / 7)
  return `${w} week${w === 1 ? '' : 's'} ago`
}

export default function PlansOverviewPage() {
  const { church, loading: churchLoading, canAddPlans } = useChurch()

  const [count, setCount] = useState(5)
  const [show, setShow] = useState({ repeats: true, rota: true })
  const [repeatWeeks, setRepeatWeeks] = useState(4)
  const [from, setFrom] = useState('') // '' = today
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  // Add (no `existing`) or change a musician on one plan.
  const [musicianModal, setMusicianModal] = useState<{ plan: OverviewPlan; existing?: ExistingMusician } | null>(null)
  const [removing, setRemoving] = useState<string | null>(null) // first row id of the person being removed
  const [actionError, setActionError] = useState<string | null>(null)
  const [songPicker, setSongPicker] = useState<{ plan: OverviewPlan; mode: SongPickerMode } | null>(null)
  const [confirmRemoveItem, setConfirmRemoveItem] = useState<{ plan: OverviewPlan; item: OverviewItem } | null>(null)
  const [reorderingPlanId, setReorderingPlanId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Remembered per browser; read after mount so the server render and first client render match.
  useEffect(() => {
    const c = readStored<number>(COUNT_KEY, 5)
    setCount(COUNTS.includes(c) ? c : 5)
    setShow({ repeats: true, rota: true, ...readStored(SHOW_KEY, {}) })
    const w = readStored<number>(REPEAT_KEY, 4)
    setRepeatWeeks(REPEAT_OPTIONS.includes(w) ? w : 4)
  }, [])

  // The app's main column is narrow by default; widen it while this page is open.
  useEffect(() => {
    document.body.classList.add('plans-overview-active')
    return () => document.body.classList.remove('plans-overview-active')
  }, [])

  const load = useCallback(() => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    api
      .get('/api/plans/overview', { params: { count, offset, repeat_weeks: repeatWeeks, ...(from ? { from } : {}) } })
      .then((res) => {
        if (id === requestId.current) setData(res.data)
      })
      .catch((err) => {
        if (id !== requestId.current) return
        setError(err?.response?.data?.error || "Couldn't load plans. Check your connection and try again.")
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false)
      })
  }, [count, offset, from, repeatWeeks])

  useEffect(() => {
    if (!church || churchLoading || !canAddPlans) return
    load()
  }, [church, churchLoading, canAddPlans, load])

  // Removes the person from that plan (every role row). The overview is reloaded afterwards so
  // rota counts and unavailability stay right; the old columns stay on screen while it loads.
  const removeMusician = async (planId: string, m: GroupedMusician) => {
    setRemoving(m.rows[0].id)
    setActionError(null)
    try {
      await Promise.all(m.rows.map((r) => api.delete(`/api/plans/${planId}/musicians/${r.id}`)))
    } catch {
      setActionError(`Couldn't remove ${m.name}. Please try again.`)
    } finally {
      setRemoving(null)
      load()
    }
  }

  const openSongPicker = (plan: OverviewPlan, mode: SongPickerMode) => {
    setActionError(null)
    setSongPicker({ plan, mode })
  }

  // Song or slot removal (other item types are only removed in the builder). A 404 means it was
  // already removed elsewhere — reload either way so the column matches the database.
  const removeItem = async () => {
    if (!confirmRemoveItem) return
    const { plan, item } = confirmRemoveItem
    try {
      await api.delete(`/api/plans/${plan.id}/items/${item.id}`)
    } catch (err: any) {
      if (err?.response?.status !== 404) setActionError("Couldn't remove that. Please try again.")
    } finally {
      setConfirmRemoveItem(null)
      load()
    }
  }

  const setPlanItems = (planId: string, items: OverviewItem[]) =>
    setData((d) => (d ? { ...d, plans: d.plans.map((p) => (p.id === planId ? { ...p, items } : p)) } : d))

  // Shows the new order straight away, then saves it. If the plan was changed elsewhere since the
  // overview loaded (409) — or the save fails — the overview reloads instead of keeping a guess.
  const reorder = async (plan: OverviewPlan, e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = plan.items.findIndex((i) => i.id === active.id)
    const to = plan.items.findIndex((i) => i.id === over.id)
    if (from < 0 || to < 0) return
    const moved = arrayMove(plan.items, from, to)
    setPlanItems(plan.id, moved)
    setReorderingPlanId(plan.id)
    setActionError(null)
    try {
      const res = await api.put(`/api/plans/${plan.id}/items/order`, { item_ids: moved.map((i) => i.id) })
      setPlanItems(plan.id, res.data.items)
    } catch (err: any) {
      setActionError(
        err?.response?.status === 409
          ? 'That plan was changed somewhere else, so the overview has been reloaded. Please try again.'
          : "Couldn't save the new order. Please try again."
      )
      load()
    } finally {
      setReorderingPlanId(null)
    }
  }

  const changeCount = (c: number) => {
    setCount(c)
    writeStored(COUNT_KEY, c)
  }
  const changeRepeatWeeks = (w: number) => {
    setRepeatWeeks(w)
    writeStored(REPEAT_KEY, w)
  }
  const toggleShow = (k: 'repeats' | 'rota') => {
    const next = { ...show, [k]: !show[k] }
    setShow(next)
    writeStored(SHOW_KEY, next)
  }

  // Song id → its uses (from the API window), for the repeat notes.
  const usesBySong = useMemo(() => {
    const m: Record<string, SongUse[]> = {}
    for (const u of data?.song_uses || []) (m[u.song_id] = m[u.song_id] || []).push(u)
    return m
  }, [data])

  // Same-day uses don't count (morning and evening services often share songs on purpose).
  // Each column only looks repeat_window_days either side of ITS OWN date, so a note doesn't
  // appear or disappear depending on how many columns are on screen.
  const repeatNotes = (item: OverviewItem, plan: OverviewPlan) => {
    if (!item.song_id || !data) return []
    const limit = data.repeat_window_days
    const planDay = parseISO(plan.plan_date)
    const others = (usesBySong[item.song_id] || []).filter(
      (u) =>
        u.plan_id !== plan.id &&
        u.plan_date !== plan.plan_date &&
        Math.abs(differenceInCalendarDays(planDay, parseISO(u.plan_date))) <= limit
    )
    const notes: { kind: 'before' | 'after'; text: string }[] = []
    const before = others.filter((u) => u.plan_date < plan.plan_date).pop()
    const after = others.find((u) => u.plan_date > plan.plan_date)
    if (before) {
      const days = differenceInCalendarDays(parseISO(plan.plan_date), parseISO(before.plan_date))
      notes.push({ kind: 'before', text: `Sung ${agoLabel(days)} (${shortDate(before.plan_date)})` })
    }
    if (after) notes.push({ kind: 'after', text: `Also planned ${shortDate(after.plan_date)}` })
    return notes
  }

  const unavailableNote = (m: OverviewMusician, date: string) => {
    if (!m.user_id) return null
    const hit = (data?.unavailability || []).find(
      (u) => u.user_id === m.user_id && u.start_date <= date && u.end_date >= date
    )
    if (!hit) return null
    return hit.note ? `Unavailable: ${hit.note}` : 'Marked unavailable'
  }

  const rota = useMemo(() => {
    const counts = new Map<string, { name: string; n: number }>()
    for (const p of data?.plans || []) {
      const seen = new Set<string>()
      for (const m of p.musicians) {
        const key = m.user_id || `name:${m.name.trim().toLowerCase()}`
        if (seen.has(key)) continue
        seen.add(key)
        const e = counts.get(key) || { name: m.name, n: 0 }
        e.n++
        counts.set(key, e)
      }
    }
    return [...counts.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
  }, [data])

  if (churchLoading) return null

  if (!canAddPlans) {
    return (
      <div className="settings-restricted">
        <p className="settings-restricted-text">Only admins and members who can add &amp; edit plans can use the plans overview.</p>
      </div>
    )
  }

  const plans = data?.plans || []

  return (
    <div className="po-page">
      <Link href="/plans" className="back-link back-link--spaced"><ArrowLeft size={14} /> Back to plans</Link>
      <div className="page-header">
        <h1 className="page-title">Plans overview</h1>
        <div className="page-header-actions">
          <Link href="/plans/new" className="btn btn-primary"><Plus size={16} /> Add new plan</Link>
        </div>
      </div>

      <div className="po-toolbar">
        <div className="po-toolbar-group">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!data?.has_previous || loading}
            onClick={() => setOffset((o) => o - 1)}
          >
            <ChevronLeft size={14} /> Earlier
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!data?.has_next || loading}
            onClick={() => setOffset((o) => o + 1)}
          >
            Later <ChevronRight size={14} />
          </button>
          <label className="po-label">
            From
            <input
              type="date"
              className="input po-date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                setOffset(0)
              }}
            />
          </label>
          {(from || offset !== 0) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setFrom('')
                setOffset(0)
              }}
            >
              Today
            </button>
          )}
        </div>
        <div className="po-toolbar-group">
          <label className="po-label">
            Plans shown
            <select className="input po-select" value={count} onChange={(e) => changeCount(Number(e.target.value))}>
              {COUNTS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <span className="po-label">Show</span>
          <label className="po-check">
            <input type="checkbox" checked={show.repeats} onChange={() => toggleShow('repeats')} /> Song repeats
          </label>
          {show.repeats && (
            <label className="po-label">
              within
              <select className="input po-select" value={repeatWeeks} onChange={(e) => changeRepeatWeeks(Number(e.target.value))}>
                {REPEAT_OPTIONS.map((w) => <option key={w} value={w}>{w} weeks</option>)}
              </select>
            </label>
          )}
          <label className="po-check">
            <input type="checkbox" checked={show.rota} onChange={() => toggleShow('rota')} /> Rota counts
          </label>
        </div>
      </div>

      {show.rota && rota.length > 0 && (
        <p className="po-rota">
          <span className="po-rota-label">On these plans:</span>{' '}
          {rota.map((r, i) => (
            <span key={r.name + i} className="po-rota-item">{r.name} {r.n}</span>
          ))}
        </p>
      )}

      {actionError && <div className="error-box po-action-error">{actionError}</div>}

      {error ? (
        <div className="po-message">
          <div className="error-box">{error}</div>
          <button type="button" className="btn btn-secondary" onClick={load}>Try again</button>
        </div>
      ) : !data && loading ? (
        <p className="text-muted">Loading…</p>
      ) : plans.length === 0 ? (
        <div className="card card-empty">
          <p className="text-muted">No plans from this date on. <Link href="/plans/new" className="link">Add one</Link></p>
        </div>
      ) : (
        <div className={`${colsClass[count] || colsClass[5]}${loading ? ' po-grid--loading' : ''}`}>
          {plans.map((plan) => {
            const songCount = plan.items.filter((i) => i.type === 'song').length
            const minutes = plan.items.reduce((sum, i) => sum + (i.duration_minutes ?? i.song_default_duration ?? 0), 0)
            return (
              <section key={plan.id} className="po-col">
                <Link href={`/plans/${plan.id}`} className="po-col-head">
                  <span className="po-col-date">{format(parseISO(plan.plan_date), 'EEE d MMM')}</span>
                  {plan.plan_time && <span className="po-col-time">{plan.plan_time}</span>}
                  <span className="po-col-title">{plan.title || 'Untitled plan'}</span>
                  {plan.status === 'draft' && <span className="badge badge-draft">DRAFT</span>}
                </Link>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => reorder(plan, e)}>
                <SortableContext items={plan.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ol className="po-items">
                  {plan.items.length === 0 && <li className="po-empty">Nothing added yet</li>}
                  {plan.items.map((item) => {
                    const dragDisabled = reorderingPlanId === plan.id
                    if (item.type === 'song') {
                      const k = item.key_override || item.song_default_key
                      const notes = show.repeats ? repeatNotes(item, plan) : []
                      const title = item.song_title || 'Song'
                      return (
                        <SortableRow key={item.id} id={item.id} disabled={dragDisabled} className="po-item po-item-song">
                          <div className="po-item-row">
                            <button
                              type="button"
                              className="po-item-pick po-item-title"
                              title="Swap for another song"
                              onClick={() => openSongPicker(plan, { kind: 'swap', itemId: item.id, currentTitle: title })}
                            >
                              {title}
                            </button>
                            {k && <KeyBadge keyOf={k} />}
                            <button
                              type="button"
                              className="po-item-remove"
                              aria-label={`Remove ${title}`}
                              title={`Remove ${title}`}
                              onClick={() => { setActionError(null); setConfirmRemoveItem({ plan, item }) }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                          {notes.map((n) => (
                            <div key={n.kind} className={n.kind === 'before' ? 'po-note po-note-before' : 'po-note po-note-after'}>
                              {n.kind === 'before' && <AlertTriangle size={11} />} {n.text}
                            </div>
                          ))}
                        </SortableRow>
                      )
                    }
                    if (isSongSlot(item)) {
                      return (
                        <SortableRow key={item.id} id={item.id} disabled={dragDisabled} className="po-item po-item-slot">
                          <div className="po-item-row">
                            <button
                              type="button"
                              className="po-item-pick"
                              title="Choose a song for this slot"
                              onClick={() => openSongPicker(plan, { kind: 'fill', itemId: item.id, label: item.title })}
                            >
                              {nonSongLabel(item)}
                            </button>
                            <button
                              type="button"
                              className="po-item-remove"
                              aria-label="Remove this slot"
                              title="Remove this slot"
                              onClick={() => { setActionError(null); setConfirmRemoveItem({ plan, item }) }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </SortableRow>
                      )
                    }
                    return (
                      <SortableRow key={item.id} id={item.id} disabled={dragDisabled} className="po-item po-item-other">
                        {nonSongLabel(item)}
                      </SortableRow>
                    )
                  })}
                </ol>
                </SortableContext>
                </DndContext>
                <button type="button" className="po-musician-add po-add-song" onClick={() => openSongPicker(plan, { kind: 'add' })}>
                  <Plus size={12} /> Add song
                </button>

                <div className="po-col-meta">
                  {songCount} song{songCount === 1 ? '' : 's'}
                  {minutes > 0 ? ` · ${minutes} min` : ''}
                </div>

                <div className="po-musicians">
                  <div className="po-musicians-head">
                    <h3 className="po-subhead">Musicians</h3>
                    <button
                      type="button"
                      className="po-musician-add"
                      onClick={() => { setActionError(null); setMusicianModal({ plan }) }}
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                  {plan.musicians.length === 0 ? (
                    <p className="po-empty">None added</p>
                  ) : (
                    <ul>
                      {groupMusicians(plan.musicians).map((m) => {
                        const un = unavailableNote(m, plan.plan_date)
                        const busy = removing === m.rows[0].id
                        return (
                          <li key={m.id} className={un ? 'po-musician po-musician-unavailable' : 'po-musician'} title={un || undefined}>
                            <button
                              type="button"
                              className="po-musician-change"
                              title="Change person or roles"
                              disabled={busy}
                              onClick={() => {
                                setActionError(null)
                                setMusicianModal({ plan, existing: { name: m.name, user_id: m.user_id, rows: m.rows } })
                              }}
                            >
                              <span>{m.name}</span>
                              {m.roles.length > 0 && <span className="po-musician-role">{m.roles.join(', ')}</span>}
                              {un && <span className="po-unavailable"><AlertTriangle size={11} /> Unavailable</span>}
                            </button>
                            <button
                              type="button"
                              className="po-musician-remove"
                              aria-label={`Remove ${m.name}`}
                              title={`Remove ${m.name}`}
                              disabled={busy}
                              onClick={() => removeMusician(plan.id, m)}
                            >
                              <X size={12} />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <Link href={`/plans/${plan.id}/edit`} className="po-edit-link">Edit plan</Link>
              </section>
            )
          })}
          {!data?.has_next && plans.length < count && (
            <Link href="/plans/new" className="po-col po-col-new">
              <Plus size={20} />
              <span>New plan</span>
            </Link>
          )}
        </div>
      )}
      {musicianModal && church && (
        <PlanMusicianModal
          // A fresh modal per person/plan, so its form state never carries over.
          key={`${musicianModal.plan.id}:${musicianModal.existing?.rows[0]?.id || 'new'}`}
          planId={musicianModal.plan.id}
          planDate={musicianModal.plan.plan_date}
          churchId={church.id}
          existing={musicianModal.existing}
          // onAdd runs after every successful save (adds and removals), so one reload covers both.
          onAdd={() => load()}
          onClose={() => setMusicianModal(null)}
        />
      )}

      {songPicker && (
        <OverviewSongPicker
          key={`${songPicker.plan.id}:${songPicker.mode.kind}:${'itemId' in songPicker.mode ? songPicker.mode.itemId : ''}`}
          planId={songPicker.plan.id}
          planTitle={songPicker.plan.title || 'Untitled plan'}
          planDate={songPicker.plan.plan_date}
          mode={songPicker.mode}
          repeatWeeks={repeatWeeks}
          inPlanSongIds={songPicker.plan.items.map((i) => i.song_id).filter((x): x is string => !!x)}
          onChosen={() => load()}
          onConflict={(msg) => { setActionError(msg); load() }}
          onClose={() => setSongPicker(null)}
        />
      )}

      {confirmRemoveItem && (
        <ConfirmModal
          title={confirmRemoveItem.item.type === 'song' ? 'Remove song?' : 'Remove slot?'}
          message={
            confirmRemoveItem.item.type === 'song'
              ? `Remove "${confirmRemoveItem.item.song_title || 'this song'}" from ${confirmRemoveItem.plan.title || 'this plan'}? Its key, arrangement and notes for this plan go with it.`
              : `Remove this "song to be chosen" slot from ${confirmRemoveItem.plan.title || 'this plan'}?`
          }
          confirmLabel="Remove"
          danger
          onConfirm={removeItem}
          onCancel={() => setConfirmRemoveItem(null)}
        />
      )}

      <p className="po-footnote">
        Song repeats look {repeatWeeks} weeks back and ahead from each plan. Songs repeated on the same day aren&apos;t
        flagged.
      </p>
    </div>
  )
}
