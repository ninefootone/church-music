'use client'

// Song picker for the Plans overview: add a song to a plan, fill a "song to be chosen" slot, or
// swap the song on a row. Each song shows when it was last used before THIS plan's date and when
// it's next planned after it, so repeats can be avoided while choosing. Uses the single-item
// routes (POST /items, PATCH /items/:itemId/song) — never the whole-list PUT /items.

import { useEffect, useMemo, useState } from 'react'
import { X, Search, AlertTriangle } from 'lucide-react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import api from '@/lib/api'
import { KeyBadge } from '@/components/ui/badges'

export type SongPickerMode =
  | { kind: 'add' }
  | { kind: 'fill'; itemId: string; label: string | null }
  | { kind: 'swap'; itemId: string; currentTitle: string }

interface PickerSong {
  id: string
  title: string
  author: string | null
  default_key: string | null
}

interface Use {
  song_id: string
  last_before: string | null
  next_after: string | null
}

interface Props {
  planId: string
  planTitle: string
  planDate: string
  mode: SongPickerMode
  repeatWeeks: number
  inPlanSongIds: string[]
  onChosen: () => void
  onConflict: (message: string) => void
  onClose: () => void
}

const MAX_SHOWN = 60
const shortDate = (d: string) => format(parseISO(d), 'd MMM')
function agoLabel(days: number) {
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  const w = Math.round(days / 7)
  return `${w} week${w === 1 ? '' : 's'} ago`
}

export function OverviewSongPicker({ planId, planTitle, planDate, mode, repeatWeeks, inPlanSongIds, onChosen, onConflict, onClose }: Props) {
  const [songs, setSongs] = useState<PickerSong[] | null>(null)
  const [uses, setUses] = useState<Record<string, Use>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoadError(null)
    Promise.all([
      api.get('/api/songs', { params: { include_retired: 'false' } }),
      api.get(`/api/plans/${planId}/song-history`),
    ])
      .then(([s, h]) => {
        const list: PickerSong[] = (s.data || []).map((x: PickerSong) => ({
          id: x.id, title: x.title, author: x.author, default_key: x.default_key,
        }))
        list.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
        setSongs(list)
        const m: Record<string, Use> = {}
        for (const u of h.data.uses || []) m[u.song_id] = u
        setUses(m)
      })
      .catch(() => setLoadError("Couldn't load songs. Check your connection and try again."))
  }
  useEffect(load, [planId]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!songs) return []
    const q = query.trim().toLowerCase()
    if (!q) return songs
    return songs.filter((s) => (s.title ?? '').toLowerCase().includes(q) || (s.author ?? '').toLowerCase().includes(q))
  }, [songs, query])

  const windowDays = repeatWeeks * 7
  const history = (songId: string) => {
    const u = uses[songId]
    const out: { text: string; recent: boolean; kind: 'before' | 'after' }[] = []
    if (u?.last_before) {
      const days = differenceInCalendarDays(parseISO(planDate), parseISO(u.last_before))
      out.push({ kind: 'before', recent: days <= windowDays, text: `Sung ${agoLabel(days)} (${shortDate(u.last_before)})` })
    }
    if (u?.next_after) {
      const days = differenceInCalendarDays(parseISO(u.next_after), parseISO(planDate))
      out.push({ kind: 'after', recent: days <= windowDays, text: `Also planned ${shortDate(u.next_after)}` })
    }
    return out
  }

  const choose = async (song: PickerSong) => {
    if (saving) return
    setSaving(song.id)
    setError(null)
    try {
      if (mode.kind === 'add') {
        await api.post(`/api/plans/${planId}/items`, { song_id: song.id })
      } else {
        await api.patch(`/api/plans/${planId}/items/${mode.itemId}/song`, { song_id: song.id })
      }
      onChosen()
      onClose()
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 404 || status === 409) {
        // The row was removed or changed elsewhere — reload the overview rather than guess.
        onConflict('That plan was changed somewhere else, so the overview has been reloaded. Please try again.')
        onClose()
        return
      }
      setError(err?.response?.data?.error || "Couldn't save. Please try again.")
      setSaving(null)
    }
  }

  const heading =
    mode.kind === 'add' ? 'Add a song' : mode.kind === 'fill' ? 'Choose a song' : 'Swap song'
  const sub =
    mode.kind === 'add'
      ? 'Added at the end of the plan.'
      : mode.kind === 'fill'
        ? `For the slot${mode.label ? ` "${mode.label}"` : ''}.`
        : `Replaces "${mode.currentTitle}". Its key and arrangement are cleared; notes are kept.`

  const shown = filtered.slice(0, MAX_SHOWN)

  return (
    <div className="bottom-sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bottom-sheet-panel po-picker">
        <div className="modal-header modal-header--tight">
          <h2 className="modal-title">{heading}</h2>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close"><X size={20} /></button>
        </div>
        <p className="po-picker-sub">
          {planTitle} · {format(parseISO(planDate), 'EEE d MMM')}. {sub}
        </p>

        <div className="po-picker-search">
          <Search size={14} />
          <input
            type="text"
            className="input"
            placeholder="Search by title or author…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        {loadError ? (
          <div className="po-message">
            <div className="error-box">{loadError}</div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Try again</button>
          </div>
        ) : !songs ? (
          <p className="text-muted">Loading songs…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted">No songs found</p>
        ) : (
          <ul className="po-picker-list">
            {shown.map((song) => {
              const h = history(song.id)
              const inPlan = inPlanSongIds.includes(song.id)
              return (
                <li key={song.id}>
                  <button
                    type="button"
                    className="po-picker-song"
                    disabled={!!saving}
                    onClick={() => choose(song)}
                  >
                    <span className="po-picker-row">
                      <span className="po-picker-title">{song.title}</span>
                      {song.default_key && <KeyBadge keyOf={song.default_key} />}
                    </span>
                    {song.author && <span className="po-picker-author">{song.author}</span>}
                    <span className="po-picker-history">
                      {inPlan && <span className="po-picker-inplan">Already in this plan</span>}
                      {h.length === 0 && !inPlan && <span className="po-picker-muted">Not used in any other plan</span>}
                      {h.map((n) => (
                        <span
                          key={n.kind}
                          className={n.recent ? (n.kind === 'before' ? 'po-note po-note-before' : 'po-note po-note-after') : 'po-picker-muted'}
                        >
                          {n.recent && n.kind === 'before' && <AlertTriangle size={11} />} {n.text}
                        </span>
                      ))}
                    </span>
                    {saving === song.id && <span className="po-picker-muted">Saving…</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {filtered.length > MAX_SHOWN && (
          <p className="po-picker-muted po-picker-more">Showing {MAX_SHOWN} of {filtered.length}, type to narrow it down.</p>
        )}
      </div>
    </div>
  )
}
