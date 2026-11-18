'use client'

// Settings → ChurchSuite (admins; only for churches the ChurchSuite sync runs for). Lists the questions the sync
// couldn't answer on its own — answered ONCE here, then the sync remembers (project doc churchsuite-integration.md,
// item 3). Backend: /api/churchsuite.
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { format, parseISO } from 'date-fns'
import api, { setAuthToken } from '@/lib/api'

interface Question {
  id: string
  kind: 'person' | 'song' | 'removed_song' | 'removed_musician'
  q_key: string
  plan_id: string | null
  plan_date: string | null
  plan_title: string | null
  payload: {
    name?: string
    title?: string
    dates?: string[]
    suggestion?: { user_id: string; name: string } | null
    on_plan?: string | null
    candidates?: { user_id?: string; id?: string; name?: string; title?: string }[]
  }
}
interface PersonAnswer { cs_key: string; cs_name: string; decision: 'member' | 'name_only' | 'ignore'; member_name: string | null }
interface SongAnswer { cs_key: string; cs_title: string; decision: 'song' | 'ignore'; song_title: string | null }
interface Member { user_id: string; name: string | null }
interface SongHit { id: string; title: string }

const fmtDate = (d: string) => format(parseISO(d), 'EEE d MMM')
const datesLabel = (ds?: string[]) => (ds && ds.length ? ds.slice().sort().map(fmtDate).join(', ') : '')

export function ChurchSuitePanel({ onCountChange }: { onCountChange?: (open: number) => void }) {
  const { getToken } = useAuth()
  const [questions, setQuestions] = useState<Question[]>([])
  const [people, setPeople] = useState<PersonAnswer[]>([])
  const [songs, setSongs] = useState<SongAnswer[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  // Stable across renders (getToken via a ref), so effects that use it don't re-run on every render.
  const tokenRef = useRef(getToken)
  tokenRef.current = getToken
  const authApi = useCallback(async () => { setAuthToken(await tokenRef.current()); return api }, [])
  // In a ref so a new callback from the parent each render doesn't re-trigger the load below.
  const countRef = useRef(onCountChange)
  countRef.current = onCountChange

  const load = useCallback(async () => {
    try {
      const a = await authApi()
      const [q, m] = await Promise.all([a.get('/api/churchsuite/questions'), a.get('/api/members')])
      setQuestions(q.data.questions); setPeople(q.data.people); setSongs(q.data.songs)
      setMembers((m.data as Member[]).filter(x => x.name).sort((x, y) => (x.name || '').localeCompare(y.name || '')))
      countRef.current?.(q.data.questions.length)
      setLoaded(true); setError('')
    } catch {
      setError('Couldn\'t load the ChurchSuite questions. Try again in a moment.')
    }
  }, [authApi])

  useEffect(() => { load() }, [load])

  async function answer(q: Question, body: Record<string, string>) {
    setBusy(q.id); setError('')
    try {
      await (await authApi()).post(`/api/churchsuite/questions/${q.id}/answer`, body)
      await load()
    } catch (err: any) {
      setError(err.response?.data?.error || 'That didn\'t save. Try again.')
    } finally {
      setBusy(null)
    }
  }

  async function forget(type: 'person' | 'song', cs_key: string) {
    setBusy(cs_key); setError('')
    try {
      await (await authApi()).post('/api/churchsuite/forget', { type, cs_key })
      await load()
    } catch {
      setError('That didn\'t save. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const byKind = (k: Question['kind'][]) => questions.filter(q => k.includes(q.kind))
  const personQs = byKind(['person'])
  const songQs = byKind(['song'])
  const removedQs = byKind(['removed_song', 'removed_musician'])

  return (
    <div className="settings-card">
      <h2 className="settings-section-heading settings-section-heading--tight">ChurchSuite</h2>
      <p className="settings-section-desc">
        Plans are kept in step with ChurchSuite three times a day. When the sync isn&apos;t sure about something it asks
        here. Answer once and it remembers; your answers are used from the next sync.
      </p>

      {error && <div className="settings-error">{error}</div>}
      {!loaded && !error && <p className="text-muted">Loading…</p>}

      {loaded && questions.length === 0 && (
        <p className="cs-empty">Nothing to answer right now.</p>
      )}

      {personQs.length > 0 && (
        <section className="cs-group">
          <h3 className="sub-section-label">People</h3>
          {personQs.map(q => (
            <PersonQuestion key={q.id} q={q} members={members} busy={busy === q.id} onAnswer={b => answer(q, b)} />
          ))}
        </section>
      )}

      {songQs.length > 0 && (
        <section className="cs-group">
          <h3 className="sub-section-label">Songs</h3>
          {songQs.map(q => (
            <SongQuestion key={q.id} q={q} authApi={authApi} busy={busy === q.id} onAnswer={b => answer(q, b)} />
          ))}
        </section>
      )}

      {removedQs.length > 0 && (
        <section className="cs-group">
          <h3 className="sub-section-label">In SongStack but not in ChurchSuite</h3>
          {removedQs.map(q => (
            <div key={q.id} className="cs-question">
              <p className="cs-question-text">
                <strong>{q.kind === 'removed_song' ? `“${q.payload.title}”` : q.payload.name}</strong>
                {q.kind === 'removed_song' ? ' is in ' : ' is on the music team for '}
                {q.plan_date ? `the ${fmtDate(q.plan_date)} plan` : 'a plan'}
                {q.plan_title ? ` (${q.plan_title})` : ''}, but not in ChurchSuite.
              </p>
              <div className="cs-actions">
                <button className="btn btn-secondary btn-sm btn-danger-text" disabled={busy === q.id} onClick={() => answer(q, { action: 'remove' })}>
                  Remove from plan
                </button>
                <button className="btn btn-secondary btn-sm" disabled={busy === q.id} onClick={() => answer(q, { action: 'keep' })}>
                  Keep
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {(people.length > 0 || songs.length > 0) && (
        <section className="cs-group">
          <h3 className="sub-section-label">Remembered answers</h3>
          <p className="service-times-hint cs-remembered-hint">Forget one and the sync will ask again next time it comes up.</p>
          <ul className="cs-remembered">
            {people.map(p => (
              <li key={p.cs_key}>
                <span>
                  {p.cs_name} → {p.decision === 'member' ? p.member_name || 'a member who has left' : p.decision === 'name_only' ? 'added by name (linked automatically if they join under this name)' : 'never added'}
                </span>
                <button className="btn btn-secondary btn-sm" disabled={busy === p.cs_key} onClick={() => forget('person', p.cs_key)}>Forget</button>
              </li>
            ))}
            {songs.map(s => (
              <li key={s.cs_key}>
                <span>“{s.cs_title}” → {s.decision === 'song' ? `“${s.song_title}”` : 'ignored'}</span>
                <button className="btn btn-secondary btn-sm" disabled={busy === s.cs_key} onClick={() => forget('song', s.cs_key)}>Forget</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function PersonQuestion({ q, members, busy, onAnswer }: { q: Question; members: Member[]; busy: boolean; onAnswer: (b: Record<string, string>) => void }) {
  const candidates = q.payload.candidates ?? []
  const [userId, setUserId] = useState(q.payload.suggestion?.user_id || candidates[0]?.user_id || '')
  const several = !q.payload.suggestion && candidates.length > 1
  return (
    <div className="cs-question">
      <p className="cs-question-text">
        <strong>{q.payload.name}</strong> is on ChurchSuite&apos;s music team
        {q.payload.dates?.length ? ` (${datesLabel(q.payload.dates)})` : ''}.{' '}
        {several
          ? `${candidates.length} members have that name — which one is it?`
          : q.payload.suggestion
            ? `Is this ${q.payload.suggestion.name}?`
            : q.payload.on_plan
              ? `Probably “${q.payload.on_plan}”, who's already on the plan by name. If they're a member, choose them; if not, choose “Not a member yet” and the plan stays as it is.`
              : 'Which member is this?'}
      </p>
      <div className="cs-actions">
        <select className="input input--sm cs-select" value={userId} onChange={e => setUserId(e.target.value)} aria-label="Member">
          <option value="">Choose a member…</option>
          {members.map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" disabled={busy || !userId} onClick={() => onAnswer({ action: 'member', user_id: userId })}>
          That&apos;s them
        </button>
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onAnswer({ action: 'name_only' })}>
          Not a member yet — add by name
        </button>
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onAnswer({ action: 'ignore' })}>
          Never add
        </button>
      </div>
    </div>
  )
}

function SongQuestion({ q, authApi, busy, onAnswer }: { q: Question; authApi: () => Promise<typeof api>; busy: boolean; onAnswer: (b: Record<string, string>) => void }) {
  const candidates = (q.payload.candidates ?? []).filter(c => c.id && c.title) as SongHit[]
  const [search, setSearch] = useState('')
  const [hits, setHits] = useState<SongHit[]>([])

  useEffect(() => {
    const term = search.trim()
    if (term.length < 2) { setHits(h => (h.length ? [] : h)); return }
    const t = setTimeout(async () => {
      try {
        const r = await (await authApi()).get('/api/songs', { params: { search: term } })
        const rows = (Array.isArray(r.data) ? r.data : r.data.songs || []) as SongHit[]
        setHits(rows.slice(0, 8))
      } catch { setHits([]) }
    }, 250)
    return () => clearTimeout(t)
  }, [search, authApi])

  return (
    <div className="cs-question">
      <p className="cs-question-text">
        <strong>“{q.payload.title}”</strong>
        {q.payload.dates?.length ? ` (${datesLabel(q.payload.dates)})` : ''}{' '}
        {candidates.length > 1 ? `matches ${candidates.length} songs in your library — which is it?` : 'isn\'t clearly in your library — which song is it?'}
      </p>
      <div className="cs-actions">
        {candidates.map(c => (
          <button key={c.id} className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onAnswer({ action: 'song', song_id: c.id })}>
            {c.title}
          </button>
        ))}
        <input
          className="input input--sm cs-select"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search your library…"
          aria-label="Search your library"
        />
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onAnswer({ action: 'ignore' })}>
          Not a song — ignore
        </button>
      </div>
      {hits.length > 0 && (
        <div className="cs-actions cs-hits">
          {hits.map(h => (
            <button key={h.id} className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onAnswer({ action: 'song', song_id: h.id })}>
              {h.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
