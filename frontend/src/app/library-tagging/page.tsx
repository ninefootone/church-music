'use client'

// Library tagging — one page to tag every master-library song without bouncing between
// song pages. Lives OUTSIDE the (app) group on purpose: helpers on the email allow-list
// don't belong to the master church (or any church), so this page must not need a church.
// Backend: backend/routes/libraryTagging.js. Owner = master-library admin (tags + flags);
// tagger = email in LIBRARY_TAGGER_EMAILS (tags only). Suggested tags (song_tag_suggestions)
// show dashed until someone accepts or dismisses them. See project doc library-tagging.md.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { LyricsDisplay } from '@/components/ui/LyricsDisplay'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type Role = 'owner' | 'tagger'
type Flag = 'is_draft' | 'in_library' | 'share_all_data'

interface Song {
  id: string
  title: string
  author: string | null
  is_draft: boolean
  in_library: boolean
  share_all_data: boolean
  has_lyrics: boolean
  file_count: number
  tag_ids: string[]
  suggestion_ids: string[]
}

interface Tag {
  id: string
  name: string
}

interface TagInfo {
  tag_id: string
  added_by: string | null
  added_at: string | null
}

interface Detail {
  lyrics: string
  tag_info: TagInfo[]
}

interface Contributor {
  name: string
  tag_count: number
  song_count: number
}

interface TagState {
  tag_ids: string[]
  suggestion_ids: string[]
}

type StatusFilter = 'all' | 'draft' | 'live'
type TagFilter = 'all' | 'none' | 'under3' | 'atleast3' | 'suggested'
type YesNoFilter = 'all' | 'yes' | 'no'

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function formatDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function LibraryTaggingPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth()

  const [role, setRole] = useState<Role | null>(null)
  const [email, setEmail] = useState('')
  const [songs, setSongs] = useState<Song[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [contributors, setContributors] = useState<Contributor[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, Detail>>({})
  const [detailError, setDetailError] = useState<string | null>(null)
  const [pending, setPending] = useState<Set<string>>(new Set())

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [tagFilter, setTagFilter] = useState<TagFilter>('all')
  const [libraryFilter, setLibraryFilter] = useState<YesNoFilter>('all')
  const [lyricsFilter, setLyricsFilter] = useState<YesNoFilter>('all')

  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})

  const call = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await getToken()
      const res = await fetch(`${API}/api/library-tagging${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status)
      return data
    },
    [getToken]
  )

  const loadContributors = useCallback(() => {
    call('/contributors')
      .then(setContributors)
      .catch(() => {}) // header extra only — the page works without it
  }, [call])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    setForbidden(false)
    try {
      const me = await call('/me')
      const [songRows, tagRows] = await Promise.all([call('/songs'), call('/tags')])
      setRole(me.role)
      setEmail(me.email || '')
      setSongs(songRows)
      setTags(tagRows)
      loadContributors()
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setForbidden(true)
      else setLoadError(err instanceof Error ? err.message : 'Could not load songs.')
    } finally {
      setLoading(false)
    }
  }, [call, loadContributors])

  useEffect(() => {
    if (isLoaded && isSignedIn) load()
  }, [isLoaded, isSignedIn, load])

  const tagName = useMemo(() => {
    const m: Record<string, string> = {}
    for (const t of tags) m[t.id] = t.name
    return m
  }, [tags])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return songs.filter((s) => {
      if (q && !s.title.toLowerCase().includes(q) && !(s.author || '').toLowerCase().includes(q)) return false
      if (statusFilter === 'draft' && !s.is_draft) return false
      if (statusFilter === 'live' && s.is_draft) return false
      const n = s.tag_ids.length
      if (tagFilter === 'none' && n !== 0) return false
      if (tagFilter === 'under3' && n >= 3) return false
      if (tagFilter === 'atleast3' && n < 3) return false
      if (tagFilter === 'suggested' && s.suggestion_ids.length === 0) return false
      if (libraryFilter === 'yes' && !s.in_library) return false
      if (libraryFilter === 'no' && s.in_library) return false
      if (lyricsFilter === 'yes' && !s.has_lyrics) return false
      if (lyricsFilter === 'no' && s.has_lyrics) return false
      return true
    })
  }, [songs, search, statusFilter, tagFilter, libraryFilter, lyricsFilter])

  const taggedCount = useMemo(() => songs.filter((s) => s.tag_ids.length > 0).length, [songs])
  const suggestedCount = useMemo(() => songs.filter((s) => s.suggestion_ids.length > 0).length, [songs])
  const selected = songs.find((s) => s.id === selectedId) || null

  // Fetch lyrics + "who added each tag" for the selected song (cached per song; ignores a
  // reply for a song that's no longer selected).
  useEffect(() => {
    if (!selectedId || details[selectedId] !== undefined) return
    const id = selectedId
    let stale = false
    setDetailError(null)
    call(`/songs/${id}/detail`)
      .then((d: Detail) => {
        if (!stale) setDetails((prev) => ({ ...prev, [id]: d }))
      })
      .catch((err) => {
        if (!stale) setDetailError(err instanceof Error ? err.message : 'Could not load lyrics.')
      })
    return () => {
      stale = true
    }
  }, [selectedId, details, call])

  // Arrow keys move through the (filtered) list when you're not typing in a box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const el = e.target as HTMLElement | null
      if (el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return
      if (filtered.length === 0) return
      e.preventDefault()
      const i = filtered.findIndex((s) => s.id === selectedId)
      const next =
        i === -1 ? 0 : e.key === 'ArrowDown' ? Math.min(i + 1, filtered.length - 1) : Math.max(i - 1, 0)
      const id = filtered[next].id
      setSelectedId(id)
      rowRefs.current[id]?.scrollIntoView({ block: 'nearest' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtered, selectedId])

  const applyState = (songId: string, state: TagState) =>
    setSongs((prev) =>
      prev.map((s) => (s.id === songId ? { ...s, tag_ids: state.tag_ids, suggestion_ids: state.suggestion_ids } : s))
    )

  // Keep the "added by" list in step with local changes; refetched next time the song is opened fresh.
  const noteAdded = (songId: string, tagIds: string[]) =>
    setDetails((prev) => {
      const d = prev[songId]
      if (!d) return prev
      const known = new Set(d.tag_info.map((t) => t.tag_id))
      const now = new Date().toISOString()
      const extra = tagIds.filter((t) => !known.has(t)).map((t) => ({ tag_id: t, added_by: 'You', added_at: now }))
      return { ...prev, [songId]: { ...d, tag_info: [...d.tag_info, ...extra] } }
    })

  const noteRemoved = (songId: string, tagId: string) =>
    setDetails((prev) => {
      const d = prev[songId]
      if (!d) return prev
      return { ...prev, [songId]: { ...d, tag_info: d.tag_info.filter((t) => t.tag_id !== tagId) } }
    })

  const withPending = async (key: string, fn: () => Promise<void>) => {
    if (pending.has(key)) return
    setActionError(null)
    setPending((p) => new Set(p).add(key))
    try {
      await fn()
    } finally {
      setPending((p) => {
        const n = new Set(p)
        n.delete(key)
        return n
      })
    }
  }

  const toggleTag = (song: Song, tagId: string) =>
    withPending(`${song.id}:${tagId}`, async () => {
      const had = song.tag_ids.includes(tagId)
      const before: TagState = { tag_ids: song.tag_ids, suggestion_ids: song.suggestion_ids }
      applyState(song.id, {
        tag_ids: had ? before.tag_ids.filter((t) => t !== tagId) : [...before.tag_ids, tagId],
        suggestion_ids: before.suggestion_ids.filter((t) => t !== tagId),
      })
      try {
        const d: TagState = await call(`/songs/${song.id}/tags/${tagId}`, { method: had ? 'DELETE' : 'POST' })
        applyState(song.id, d)
        if (had) noteRemoved(song.id, tagId)
        else noteAdded(song.id, [tagId])
      } catch (err) {
        applyState(song.id, before)
        setActionError(`Couldn't update tags on "${song.title}": ${err instanceof Error ? err.message : 'error'}`)
      }
    })

  const dismissSuggestion = (song: Song, tagId: string) =>
    withPending(`${song.id}:${tagId}`, async () => {
      const before: TagState = { tag_ids: song.tag_ids, suggestion_ids: song.suggestion_ids }
      applyState(song.id, { ...before, suggestion_ids: before.suggestion_ids.filter((t) => t !== tagId) })
      try {
        applyState(song.id, await call(`/songs/${song.id}/suggestions/${tagId}`, { method: 'DELETE' }))
      } catch (err) {
        applyState(song.id, before)
        setActionError(`Couldn't dismiss suggestion on "${song.title}": ${err instanceof Error ? err.message : 'error'}`)
      }
    })

  const acceptAll = (song: Song) =>
    withPending(`${song.id}:accept-all`, async () => {
      const before: TagState = { tag_ids: song.tag_ids, suggestion_ids: song.suggestion_ids }
      applyState(song.id, {
        tag_ids: Array.from(new Set([...before.tag_ids, ...before.suggestion_ids])),
        suggestion_ids: [],
      })
      try {
        const d: TagState = await call(`/songs/${song.id}/suggestions/accept`, { method: 'POST' })
        applyState(song.id, d)
        noteAdded(song.id, before.suggestion_ids)
      } catch (err) {
        applyState(song.id, before)
        setActionError(`Couldn't accept suggestions on "${song.title}": ${err instanceof Error ? err.message : 'error'}`)
      }
    })

  const toggleFlag = (song: Song, flag: Flag) =>
    withPending(`${song.id}:${flag}`, async () => {
      const value = !song[flag]
      setSongs((prev) => prev.map((s) => (s.id === song.id ? { ...s, [flag]: value } : s)))
      try {
        const d = await call(`/songs/${song.id}/flags`, { method: 'PATCH', body: JSON.stringify({ [flag]: value }) })
        setSongs((prev) =>
          prev.map((s) =>
            s.id === song.id
              ? { ...s, is_draft: d.is_draft, in_library: d.in_library, share_all_data: d.share_all_data }
              : s
          )
        )
      } catch (err) {
        setSongs((prev) => prev.map((s) => (s.id === song.id ? { ...s, [flag]: !value } : s)))
        setActionError(`Couldn't update "${song.title}": ${err instanceof Error ? err.message : 'error'}`)
      }
    })

  // ── Signed out / no access / loading ─────────────────────────────────────
  if (!isLoaded) return <div className="lt-message">Loading…</div>

  if (!isSignedIn) {
    const back = typeof window !== 'undefined' ? window.location.href : '/library-tagging'
    return (
      <div className="lt-message">
        <h1>Library tagging</h1>
        <p>Sign in with the email address you were invited with.</p>
        <a className="btn btn-primary" href={`/sign-in?redirect_url=${encodeURIComponent(back)}`}>
          Sign in
        </a>
      </div>
    )
  }

  if (loading) return <div className="lt-message">Loading songs…</div>

  if (forbidden) {
    return (
      <div className="lt-message">
        <h1>Library tagging</h1>
        <p>This account doesn&apos;t have access. If you&apos;ve been asked to help, check you signed in with the email address you gave us.</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="lt-message">
        <div className="error-box">{loadError}</div>
        <button className="btn btn-secondary" onClick={load}>Try again</button>
      </div>
    )
  }

  const isOwner = role === 'owner'
  const detail = selected ? details[selected.id] : undefined
  const infoByTag: Record<string, TagInfo> = {}
  for (const t of detail?.tag_info || []) infoByTag[t.tag_id] = t

  return (
    <div className="lt-page">
      <header className="lt-header">
        <div>
          <h1>Library tagging</h1>
          <p className="lt-sub">
            {taggedCount} of {songs.length} songs have tags · {suggestedCount} with suggestions to review · showing{' '}
            {filtered.length}
            {email ? ` · signed in as ${email}` : ''}
            {isOwner ? '' : ' · you can add and remove tags'}
          </p>
          {contributors.length > 0 && (
            <p className="lt-sub">
              Tags added:{' '}
              {contributors.map((c, i) => (
                <span key={c.name + i}>
                  {i > 0 ? ' · ' : ''}
                  {c.name} {c.tag_count} ({c.song_count} songs)
                </span>
              ))}
            </p>
          )}
        </div>
        <p className="lt-hint">Click a song to see its lyrics and tags. Use ↑ ↓ to move between songs.</p>
      </header>

      <div className="lt-filters">
        <input
          className="input lt-search"
          placeholder="Search title or author"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label>
          Status
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="live">Live</option>
          </select>
        </label>
        <label>
          Tags
          <select className="input" value={tagFilter} onChange={(e) => setTagFilter(e.target.value as TagFilter)}>
            <option value="all">All</option>
            <option value="suggested">Has suggestions</option>
            <option value="none">No tags</option>
            <option value="under3">Fewer than 3</option>
            <option value="atleast3">3 or more</option>
          </select>
        </label>
        <label>
          Public library
          <select className="input" value={libraryFilter} onChange={(e) => setLibraryFilter(e.target.value as YesNoFilter)}>
            <option value="all">All</option>
            <option value="yes">In library</option>
            <option value="no">Not in library</option>
          </select>
        </label>
        <label>
          Lyrics
          <select className="input" value={lyricsFilter} onChange={(e) => setLyricsFilter(e.target.value as YesNoFilter)}>
            <option value="all">All</option>
            <option value="yes">Has lyrics</option>
            <option value="no">No lyrics</option>
          </select>
        </label>
      </div>

      {actionError && <div className="error-box lt-action-error">{actionError}</div>}

      <div className="lt-layout">
        <div className="lt-table-wrap">
          <table className="lt-table">
            <thead>
              <tr>
                <th>Song</th>
                <th>Tags</th>
                <th className="lt-flag-col">Draft</th>
                <th className="lt-flag-col">Library</th>
                <th className="lt-flag-col">Share all</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  ref={(el) => {
                    rowRefs.current[s.id] = el
                  }}
                  className={s.id === selectedId ? 'lt-row lt-row-selected' : 'lt-row'}
                  onClick={() => setSelectedId(s.id)}
                >
                  <td>
                    <div className="lt-title">{s.title}</div>
                    {s.author && <div className="lt-author">{s.author}</div>}
                  </td>
                  <td>
                    {s.tag_ids.length === 0 && s.suggestion_ids.length === 0 ? (
                      <span className="lt-none">No tags</span>
                    ) : (
                      <div className="lt-row-tags">
                        {s.tag_ids.map((id) => (
                          <span key={id} className="tag-chip">{tagName[id] || '…'}</span>
                        ))}
                        {s.suggestion_ids.map((id) => (
                          <span key={`s-${id}`} className="lt-chip-suggested">{tagName[id] || '…'}?</span>
                        ))}
                      </div>
                    )}
                  </td>
                  {(['is_draft', 'in_library', 'share_all_data'] as Flag[]).map((flag) => (
                    <td key={flag} className="lt-flag-col" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={s[flag]}
                        disabled={!isOwner || pending.has(`${s.id}:${flag}`)}
                        onChange={() => toggleFlag(s, flag)}
                        aria-label={`${flag.replace(/_/g, ' ')}: ${s.title}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="lt-none">No songs match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className="lt-panel">
          {!selected ? (
            <p className="lt-none">Select a song to tag it.</p>
          ) : (
            <>
              <h2 className="lt-panel-title">{selected.title}</h2>
              {selected.author && <div className="lt-author">{selected.author}</div>}
              {isOwner && (
                <a className="lt-open-link" href={`/songs/${selected.id}`} target="_blank" rel="noreferrer">
                  Open song page ↗
                </a>
              )}

              {selected.suggestion_ids.length > 0 && (
                <>
                  <h3 className="lt-panel-heading">Suggested ({selected.suggestion_ids.length})</h3>
                  <div className="lt-tag-picker">
                    {selected.suggestion_ids.map((id) => (
                      <span key={id} className="lt-suggestion">
                        <button
                          type="button"
                          className="lt-suggestion-accept"
                          disabled={pending.has(`${selected.id}:${id}`)}
                          onClick={() => toggleTag(selected, id)}
                          title="Add this tag"
                        >
                          + {tagName[id] || '…'}
                        </button>
                        <button
                          type="button"
                          className="lt-suggestion-dismiss"
                          disabled={pending.has(`${selected.id}:${id}`)}
                          onClick={() => dismissSuggestion(selected, id)}
                          aria-label={`Dismiss ${tagName[id] || 'suggestion'}`}
                          title="Dismiss suggestion"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm lt-accept-all"
                    disabled={pending.has(`${selected.id}:accept-all`)}
                    onClick={() => acceptAll(selected)}
                  >
                    Accept all suggestions
                  </button>
                </>
              )}

              <h3 className="lt-panel-heading">Tags ({selected.tag_ids.length})</h3>
              <div className="lt-tag-picker">
                {tags.map((t) => {
                  const on = selected.tag_ids.includes(t.id)
                  const suggested = !on && selected.suggestion_ids.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={on ? 'lt-tag lt-tag-on' : suggested ? 'lt-tag lt-tag-suggested' : 'lt-tag'}
                      disabled={pending.has(`${selected.id}:${t.id}`)}
                      onClick={() => toggleTag(selected, t.id)}
                      aria-pressed={on}
                    >
                      {on ? '✓ ' : ''}
                      {t.name}
                    </button>
                  )
                })}
              </div>

              {selected.tag_ids.length > 0 && (
                <>
                  <h3 className="lt-panel-heading">Added by</h3>
                  {!detail ? (
                    <p className="lt-none">Loading…</p>
                  ) : (
                    <ul className="lt-added-by">
                      {selected.tag_ids.map((id) => {
                        const info = infoByTag[id]
                        return (
                          <li key={id}>
                            <span className="lt-added-tag">{tagName[id] || '…'}</span>{' '}
                            {info?.added_by
                              ? `${info.added_by}${info.added_at ? ` · ${formatDate(info.added_at)}` : ''}`
                              : 'before tracking'}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </>
              )}

              <h3 className="lt-panel-heading">Lyrics</h3>
              {!selected.has_lyrics ? (
                <p className="lt-none">No lyrics stored for this song.</p>
              ) : detailError && !detail ? (
                <div className="error-box">{detailError}</div>
              ) : !detail ? (
                <p className="lt-none">Loading lyrics…</p>
              ) : (
                <div className="lt-lyrics">
                  <LyricsDisplay lyrics={detail.lyrics} />
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
