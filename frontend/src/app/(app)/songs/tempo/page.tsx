'use client'

// /songs/tempo — "Tempo & time": fill in tempo + time signature for the whole library in one place (added
// 2026-11-21 for the iPad metronome, which reads them). Every church; song managers only. Each change saves on its own:
// tempo when you leave the box, time signature as soon as you pick it. Rows are filtered by what was missing when the
// page LOADED, so a row you've just finished doesn't jump away while you're working down the list.
// Tempo = the beat you count (dotted ♩ in 6/8 etc. — see lib/tempoNote.ts). Each tempo box is labelled with its note,
// and "Check 6/8 tempos" lists compound-time songs whose tempo looks like a ♪ tempo, with a one-tap ÷3 (2026-11-25).
// Backend: GET /api/songs/tempo-check, PATCH /api/songs/:id/tempo, PUT /api/songs/:id/arrangements/:arrangementId.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'
import { tempoNote, looksLikeQuaverTempo } from '@/lib/tempoNote'

type Row = {
  song_id: string
  arrangement_id: string | null
  title: string
  author: string | null
  ccli_number: string | null
  version: string
  has_arrangements: boolean
  tempo: number | null
  time_signature: string | null
  suggested_tempo: number | null
  suggested_time_signature: string | null
}
type Status = { state: 'saving' | 'saved' | 'error'; msg?: string }

const rowKey = (r: Row) => r.arrangement_id ?? `song:${r.song_id}`
const isMissing = (r: Row) => !(r.tempo && r.tempo > 0) || !r.time_signature
const isSuspect = (r: Row) => looksLikeQuaverTempo(r.tempo, r.time_signature)
type Filter = 'missing' | 'check' | 'all'

export default function TempoPage() {
  const { church, loading: churchLoading, canManageSongs } = useChurch()
  const [rows, setRows] = useState<Row[]>([])
  const [sigs, setSigs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [missingAtLoad, setMissingAtLoad] = useState<Set<string>>(new Set())
  const [suspectAtLoad, setSuspectAtLoad] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<Filter>('missing')
  const [search, setSearch] = useState('')
  const [tempoDrafts, setTempoDrafts] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<Record<string, Status>>({})

  const load = async () => {
    setLoading(true); setLoadError(false)
    try {
      const { data } = await api.get('/api/songs/tempo-check')
      const list: Row[] = data.rows ?? []
      setRows(list)
      setSigs(data.time_signatures ?? [])
      setMissingAtLoad(new Set(list.filter(isMissing).map(rowKey)))
      setSuspectAtLoad(new Set(list.filter(isSuspect).map(rowKey)))
      setTempoDrafts({})
      setStatus({})
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (church && canManageSongs) load() }, [church, canManageSongs])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r =>
      (filter === 'all' || (filter === 'missing' ? missingAtLoad : suspectAtLoad).has(rowKey(r))) &&
      (!q || r.title.toLowerCase().includes(q) || (r.author ?? '').toLowerCase().includes(q)))
  }, [rows, filter, missingAtLoad, suspectAtLoad, search])

  const stillMissing = rows.filter(isMissing).length
  const stillSuspect = rows.filter(isSuspect).length

  const save = async (r: Row, change: { tempo?: number | null; time_signature?: string | null }) => {
    const k = rowKey(r)
    setStatus(s => ({ ...s, [k]: { state: 'saving' } }))
    try {
      if (r.arrangement_id) await api.put(`/api/songs/${r.song_id}/arrangements/${r.arrangement_id}`, change)
      else await api.patch(`/api/songs/${r.song_id}/tempo`, change)
      setRows(list => list.map(x => (rowKey(x) === k ? { ...x, ...change } : x)))
      setStatus(s => ({ ...s, [k]: { state: 'saved' } }))
    } catch (e: any) {
      setStatus(s => ({ ...s, [k]: { state: 'error', msg: e?.response?.data?.error || 'Not saved — try again' } }))
    }
  }

  const commitTempo = (r: Row) => {
    const k = rowKey(r)
    const raw = tempoDrafts[k]
    if (raw === undefined) return
    const trimmed = raw.trim()
    const next = trimmed === '' ? null : Number(trimmed)
    if (next !== null && (!Number.isInteger(next) || next < 20 || next > 300)) {
      setStatus(s => ({ ...s, [k]: { state: 'error', msg: 'Tempo must be a whole number from 20 to 300' } }))
      return
    }
    if (next === (r.tempo ?? null)) return
    save(r, { tempo: next })
  }

  // "♪ = 110" typed as the tempo of a 6/8 song: the dotted ♩ is a third of it.
  const fromQuaver = (r: Row) => {
    if (!r.tempo) return
    setTempoDrafts(d => { const n = { ...d }; delete n[rowKey(r)]; return n })
    save(r, { tempo: Math.round(r.tempo / 3) })
  }

  const applySuggestion = (r: Row) => {
    const change: { tempo?: number; time_signature?: string } = {}
    if (!(r.tempo && r.tempo > 0) && r.suggested_tempo) change.tempo = r.suggested_tempo
    if (!r.time_signature && r.suggested_time_signature && sigs.includes(r.suggested_time_signature)) {
      change.time_signature = r.suggested_time_signature
    }
    if (change.tempo !== undefined) setTempoDrafts(d => { const n = { ...d }; delete n[rowKey(r)]; return n })
    if (Object.keys(change).length) save(r, change)
  }

  if (churchLoading) return null
  if (!canManageSongs) {
    return (
      <div>
        <div className="page-header"><h1 className="page-title">Tempo &amp; time</h1></div>
        <p className="tempo-intro">Only admins and people who can add &amp; edit songs can use this page.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tempo &amp; time</h1>
        <div className="page-header-actions">
          <Link href="/songs" className="btn-text">← Songs</Link>
        </div>
      </div>

      <p className="tempo-intro">
        The iPad app&apos;s metronome starts at each song&apos;s tempo, and uses the time signature to count the beats and
        subdivisions (in threes for 6/8, 9/8 and 12/8). The tempo is the beat you count: a <strong>dotted ♩</strong> in
        6/8, 9/8 and 12/8 — so if the music says ♪ = 110, the tempo is 37. Each change saves straight away.
      </p>

      <div className="tempo-toolbar">
        <div className="tempo-filters">
          <button type="button" className={`filter-chip${filter === 'missing' ? ' is-active' : ''}`} onClick={() => setFilter('missing')}>Missing something</button>
          {suspectAtLoad.size > 0 && (
            <button type="button" className={`filter-chip${filter === 'check' ? ' is-active' : ''}`} onClick={() => setFilter('check')}
              title="6/8, 9/8 and 12/8 songs with a tempo of 100 or more — probably a ♪ tempo">
              Check 6/8 tempos ({stillSuspect})
            </button>
          )}
          <button type="button" className={`filter-chip${filter === 'all' ? ' is-active' : ''}`} onClick={() => setFilter('all')}>All songs</button>
        </div>
        <div className="tempo-search">
          <Search size={16} className="tempo-search-icon" />
          <input className="input tempo-search-input" placeholder="Search title or author" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {!loading && !loadError && (
          <span className="tempo-count">{stillMissing === 0 ? 'Nothing missing' : `${stillMissing} still missing something`}</span>
        )}
      </div>

      {loading && <p className="tempo-intro">Loading…</p>}
      {loadError && (
        <p className="text-danger">Couldn&apos;t load your songs. <button type="button" className="btn-text" onClick={load}>Try again</button></p>
      )}
      {!loading && !loadError && visible.length === 0 && (
        <p className="tempo-intro">
          {search ? 'No songs match.' : filter === 'missing' ? 'Every song has a tempo and time signature.' : filter === 'check' ? 'Nothing to check.' : 'No songs match.'}
        </p>
      )}

      {!loading && !loadError && visible.length > 0 && (
        <div className="list-box tempo-list">
          {visible.map(r => {
            const k = rowKey(r)
            const st = status[k]
            const tempoValue = tempoDrafts[k] ?? (r.tempo ? String(r.tempo) : '')
            const canSuggest = (!(r.tempo && r.tempo > 0) && !!r.suggested_tempo) ||
              (!r.time_signature && !!r.suggested_time_signature && sigs.includes(r.suggested_time_signature))
            const sigOptions = r.time_signature && !sigs.includes(r.time_signature) ? [...sigs, r.time_signature] : sigs
            return (
              <div key={k} className="tempo-row">
                <div className="tempo-row-song">
                  <Link href={`/songs/${r.song_id}`} className="tempo-row-title">{r.title}</Link>
                  {r.has_arrangements && <span className="badge badge-arrangement">{r.version}</span>}
                  {(r.author || r.ccli_number) && (
                    <div className="tempo-row-sub">
                      {r.author}
                      {r.author && r.ccli_number && ' · '}
                      {r.ccli_number && (
                        <a href={`https://songselect.ccli.com/songs/${encodeURIComponent(r.ccli_number.trim())}`} target="_blank" rel="noopener noreferrer"
                          className="tempo-ccli" title="Open on SongSelect (tempo and time signature are on the song's page there)">
                          CCLI {r.ccli_number} ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <label className="tempo-field">
                  <span className="tempo-field-label" title="The tempo counts this note (beats per minute)">{tempoNote(r.time_signature)} / min</span>
                  <input
                    className="input tempo-input"
                    type="number" inputMode="numeric" min={20} max={300} placeholder="—"
                    value={tempoValue}
                    onChange={e => setTempoDrafts(d => ({ ...d, [k]: e.target.value }))}
                    onBlur={() => commitTempo(r)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  />
                </label>
                <label className="tempo-field">
                  <span className="tempo-field-label">Time</span>
                  <select
                    className="input tempo-select"
                    value={r.time_signature ?? ''}
                    onChange={e => save(r, { time_signature: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {sigOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <div className="tempo-row-end">
                  {isSuspect(r) && (
                    <button type="button" className="btn btn-secondary btn-compact tempo-suggest" onClick={() => fromQuaver(r)}
                      title={`If the music says ♪ = ${r.tempo}, the dotted ♩ tempo is ${Math.round((r.tempo ?? 0) / 3)}`}>
                      ♪ = {r.tempo}? Use {Math.round((r.tempo ?? 0) / 3)}
                    </button>
                  )}
                  {canSuggest && (
                    <button type="button" className="btn btn-secondary btn-compact tempo-suggest" onClick={() => applySuggestion(r)}
                      title="From the Song Stack Library's copy of this song">
                      Use {[r.suggested_tempo, r.suggested_time_signature].filter(Boolean).join(' · ')}
                    </button>
                  )}
                  {st?.state === 'saving' && <span className="tempo-status">Saving…</span>}
                  {st?.state === 'saved' && <span className="tempo-status tempo-status--ok">✓ Saved</span>}
                  {st?.state === 'error' && <span className="tempo-status tempo-status--err">{st.msg}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
