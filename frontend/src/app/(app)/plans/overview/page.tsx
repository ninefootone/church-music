'use client'

// Plans → Overview (/plans/overview): read-only view of several upcoming plans side by side,
// so songs and rotas can be chosen with the weeks around them in view. Stage 1 of the
// multi-plan planner (see project doc plans-overview.md). Never writes anything — clicking a
// column opens the normal plan page. Data: GET /api/plans/overview (planners only, drafts included).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, AlertTriangle } from 'lucide-react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import api from '@/lib/api'
import { useChurch } from '@/context/ChurchContext'
import { KeyBadge } from '@/components/ui/badges'
import { isSongSlot, nonSongLabel } from '@/lib/planItems'

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

function agoLabel(days: number) {
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  const w = Math.round(days / 7)
  return `${w} week${w === 1 ? '' : 's'} ago`
}

export default function PlansOverviewPage() {
  const { church, loading: churchLoading, canAddPlans } = useChurch()

  const [count, setCount] = useState(5)
  const [show, setShow] = useState({ repeats: true, rota: true })
  const [from, setFrom] = useState('') // '' = today
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  // Remembered per browser; read after mount so the server render and first client render match.
  useEffect(() => {
    const c = readStored<number>(COUNT_KEY, 5)
    setCount(COUNTS.includes(c) ? c : 5)
    setShow({ repeats: true, rota: true, ...readStored(SHOW_KEY, {}) })
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
      .get('/api/plans/overview', { params: { count, offset, ...(from ? { from } : {}) } })
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
  }, [count, offset, from])

  useEffect(() => {
    if (!church || churchLoading || !canAddPlans) return
    load()
  }, [church, churchLoading, canAddPlans, load])

  const changeCount = (c: number) => {
    setCount(c)
    writeStored(COUNT_KEY, c)
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
  const repeatNotes = (item: OverviewItem, plan: OverviewPlan) => {
    if (!item.song_id) return []
    const others = (usesBySong[item.song_id] || []).filter((u) => u.plan_id !== plan.id && u.plan_date !== plan.plan_date)
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

                <ol className="po-items">
                  {plan.items.length === 0 && <li className="po-empty">Nothing added yet</li>}
                  {plan.items.map((item) => {
                    if (item.type === 'song') {
                      const k = item.key_override || item.song_default_key
                      const notes = show.repeats ? repeatNotes(item, plan) : []
                      return (
                        <li key={item.id} className="po-item po-item-song">
                          <div className="po-item-row">
                            <span className="po-item-title">{item.song_title || 'Song'}</span>
                            {k && <KeyBadge keyOf={k} />}
                          </div>
                          {notes.map((n) => (
                            <div key={n.kind} className={n.kind === 'before' ? 'po-note po-note-before' : 'po-note po-note-after'}>
                              {n.kind === 'before' && <AlertTriangle size={11} />} {n.text}
                            </div>
                          ))}
                        </li>
                      )
                    }
                    return (
                      <li key={item.id} className={isSongSlot(item) ? 'po-item po-item-slot' : 'po-item po-item-other'}>
                        {nonSongLabel(item)}
                      </li>
                    )
                  })}
                </ol>

                <div className="po-col-meta">
                  {songCount} song{songCount === 1 ? '' : 's'}
                  {minutes > 0 ? ` · ${minutes} min` : ''}
                </div>

                <div className="po-musicians">
                  <h3 className="po-subhead">Musicians</h3>
                  {plan.musicians.length === 0 ? (
                    <p className="po-empty">None added</p>
                  ) : (
                    <ul>
                      {plan.musicians.map((m) => {
                        const un = unavailableNote(m, plan.plan_date)
                        return (
                          <li key={m.id} className={un ? 'po-musician po-musician-unavailable' : 'po-musician'} title={un || undefined}>
                            <span>{m.name}</span>
                            {m.role && <span className="po-musician-role">{m.role}</span>}
                            {un && <span className="po-unavailable"><AlertTriangle size={11} /> Unavailable</span>}
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
      <p className="po-footnote">
        Song repeats look back and ahead {data?.repeat_window_days ? Math.round(data.repeat_window_days / 7) : 4} weeks.
        Songs repeated on the same day aren&apos;t flagged.
      </p>
    </div>
  )
}
