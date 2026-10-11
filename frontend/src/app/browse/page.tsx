'use client'

// Discover-only mode (/browse). Not linked from anywhere in the app — the entry point is a link on
// the Music Ministry site. Onboarding only offers a way back here to people who've used it before
// (localStorage 'songstack.browseUser'). Anyone signed in CAN open /browse; that's fine — it only
// exposes what's cleared for free anyway. Lives OUTSIDE the (app) group on purpose — like /library-tagging —
// so a signed-in user with no church isn't pushed to onboarding by ChurchContext. Free: browse the
// master library, favourite songs (per user), and download lyrics/files ONLY for songs whose files
// the library owner has cleared (songs.files_cleared). Everything else is the upgrade pitch.
// Backend: backend/routes/browse.js. See project doc song-rights-and-discover-only.md.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Heart } from 'lucide-react'
import { LyricsDisplay } from '@/components/ui/LyricsDisplay'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ListSong {
  id: string
  title: string
  author: string | null
  default_key: string | null
  free: boolean
  is_favourite: boolean
  tags: string[]
}

interface SongFile {
  id: string
  file_type: string
  label: string | null
  key_of: string | null
  url: string
}

interface Video {
  url: string
  label: string | null
  link_type: string | null
}

interface SongDetail extends ListSong {
  first_line: string | null
  ccli_number: string | null
  copyright_info: string | null
  bible_references: string | null
  lyrics: string | null
  videos: Video[]
  files: SongFile[]
}

interface Tag {
  id: string
  name: string
}

export default function BrowsePage() {
  const { isLoaded, isSignedIn, getToken } = useAuth()

  const [churchName, setChurchName] = useState<string | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [songs, setSongs] = useState<ListSong[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [favouritesOnly, setFavouritesOnly] = useState(false)
  const [freeOnly, setFreeOnly] = useState(false)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SongDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)

  const call = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await getToken()
      const res = await fetch(`${API}/api/browse${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
      return data
    },
    [getToken]
  )

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Filters changed → back to page 1.
  useEffect(() => {
    setPage(1)
  }, [debounced, tagIds, favouritesOnly, freeOnly])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    try {
      localStorage.setItem('songstack.browseUser', '1') // lets onboarding offer a way back here
    } catch {
      // storage blocked — onboarding just won't show the link
    }
    call('/me').then((d) => setChurchName(d.church_name)).catch(() => {}) // banner wording only
    call('/tags').then(setTags).catch(() => {}) // filter chips only — the list works without them
  }, [isLoaded, isSignedIn, call])

  const loadSongs = useCallback(() => {
    const params = new URLSearchParams({ page: String(page) })
    if (debounced.trim()) params.set('q', debounced.trim())
    if (tagIds.length) params.set('tags', tagIds.join(','))
    if (favouritesOnly) params.set('favourites', '1')
    if (freeOnly) params.set('free', '1')
    let stale = false
    setLoading(true)
    setError(null)
    call(`/songs?${params}`)
      .then((d) => {
        if (stale) return
        setSongs(d.songs)
        setTotal(d.total)
        setPages(d.pages)
      })
      .catch((err) => {
        if (!stale) setError(err instanceof Error ? err.message : 'Could not load songs.')
      })
      .finally(() => {
        if (!stale) setLoading(false)
      })
    return () => {
      stale = true
    }
  }, [call, page, debounced, tagIds, favouritesOnly, freeOnly])

  useEffect(() => {
    if (isLoaded && isSignedIn) return loadSongs()
  }, [isLoaded, isSignedIn, loadSongs])

  useEffect(() => {
    if (!selectedId) return
    let stale = false
    setDetail(null)
    setDetailError(null)
    call(`/songs/${selectedId}`)
      .then((d: SongDetail) => {
        if (!stale) setDetail(d)
      })
      .catch((err) => {
        if (!stale) setDetailError(err instanceof Error ? err.message : 'Could not load this song.')
      })
    return () => {
      stale = true
    }
  }, [selectedId, call])

  const toggleFavourite = async (song: { id: string; title: string; is_favourite: boolean }) => {
    const value = !song.is_favourite
    const apply = (v: boolean) => {
      setSongs((prev) => prev.map((s) => (s.id === song.id ? { ...s, is_favourite: v } : s)))
      setDetail((d) => (d && d.id === song.id ? { ...d, is_favourite: v } : d))
    }
    setActionError(null)
    apply(value)
    try {
      await call(`/favourites/${song.id}`, { method: value ? 'POST' : 'DELETE' })
    } catch (err) {
      apply(!value)
      setActionError(`Couldn't update favourites for "${song.title}": ${err instanceof Error ? err.message : 'error'}`)
    }
  }

  const toggleTag = (id: string) =>
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))

  // ── Signed out ─────────────────────────────────────────────────────────────
  if (!isLoaded) return <div className="lt-message">Loading…</div>

  if (!isSignedIn) {
    return (
      <div className="br-signed-out">
        <img src="/logo-strap.svg" alt="SongStack" className="br-logo" />
        <h1>Free church song library</h1>
        <p>
          Browse hundreds of hymns and worship songs, search by title, lyric or theme, and save your favourites.
          Free — you just need an account.
        </p>
        <div className="br-signed-out-actions">
          <a className="btn btn-primary" href={`/sign-up?redirect_url=${encodeURIComponent('/browse')}`}>
            Create a free account
          </a>
          <a className="btn btn-secondary" href={`/sign-in?redirect_url=${encodeURIComponent('/browse')}`}>
            Sign in
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="br-page">
      <header className="br-header">
        <img src="/logo-strap.svg" alt="SongStack" className="br-logo" />
        {churchName ? (
          <a className="btn btn-secondary btn-sm" href="/dashboard">Back to {churchName}</a>
        ) : (
          <a className="btn btn-primary btn-sm" href="/onboarding">Set up your church</a>
        )}
      </header>

      {!churchName && (
        <div className="br-upgrade">
          <div>
            <strong>You&apos;re browsing the free song library.</strong> Set up your church on SongStack to add your own
            songs and files, plan services, and share them with your team.
          </div>
          <a className="btn btn-primary btn-sm" href="/onboarding">Get started</a>
        </div>
      )}

      <div className="br-filters">
        <input
          className="input br-search"
          placeholder="Search title, lyric or theme"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="br-toggle">
          <input type="checkbox" checked={favouritesOnly} onChange={(e) => setFavouritesOnly(e.target.checked)} />
          Favourites
        </label>
        <label className="br-toggle">
          <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} />
          Free downloads
        </label>
      </div>
      {tags.length > 0 && (
        <div className="br-tags">
          {tags.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tagIds.includes(t.id) ? 'lt-tag lt-tag-on' : 'lt-tag'}
              onClick={() => toggleTag(t.id)}
              aria-pressed={tagIds.includes(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {actionError && <div className="error-box">{actionError}</div>}

      <div className="br-layout">
        <div className="br-list">
          <p className="br-count">{loading ? 'Loading…' : `${total} song${total === 1 ? '' : 's'}`}</p>
          {error ? (
            <div className="br-error">
              <div className="error-box">{error}</div>
              <button className="btn btn-secondary btn-sm" onClick={loadSongs}>Try again</button>
            </div>
          ) : (
            <ul className="br-songs">
              {songs.map((s) => (
                <li key={s.id} className={s.id === selectedId ? 'br-song br-song-selected' : 'br-song'}>
                  <button
                    type="button"
                    className="br-song-main"
                    onClick={() => {
                      setSelectedId(s.id)
                      setTimeout(() => panelRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0)
                    }}
                  >
                    <span className="br-song-title">{s.title}</span>
                    {s.author && <span className="br-song-author">{s.author}</span>}
                    <span className="br-song-meta">
                      {s.default_key && <span className="badge badge-key">{s.default_key}</span>}
                      {s.free && <span className="lt-rights lt-rights-cleared">Free download</span>}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={s.is_favourite ? 'br-fav br-fav-on' : 'br-fav'}
                    onClick={() => toggleFavourite(s)}
                    aria-pressed={s.is_favourite}
                    aria-label={s.is_favourite ? `Remove ${s.title} from favourites` : `Add ${s.title} to favourites`}
                  >
                    <Heart size={18} fill={s.is_favourite ? 'currentColor' : 'none'} />
                  </button>
                </li>
              ))}
              {!loading && songs.length === 0 && (
                <li className="lt-none">{favouritesOnly ? 'No favourites yet — tap the heart on any song.' : 'No songs match.'}</li>
              )}
            </ul>
          )}
          {pages > 1 && (
            <div className="br-pager">
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Previous</button>
              <span>Page {page} of {pages}</span>
              <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next ›</button>
            </div>
          )}
        </div>

        <aside className="br-panel" ref={panelRef}>
          {!selectedId ? (
            <p className="lt-none">Choose a song to see more.</p>
          ) : detailError ? (
            <div className="error-box">{detailError}</div>
          ) : !detail ? (
            <p className="lt-none">Loading…</p>
          ) : (
            <>
              <div className="br-panel-head">
                <div>
                  <h2 className="lt-panel-title">{detail.title}</h2>
                  {detail.author && <div className="lt-author">{detail.author}</div>}
                </div>
                <button
                  type="button"
                  className={detail.is_favourite ? 'br-fav br-fav-on' : 'br-fav'}
                  onClick={() => toggleFavourite(detail)}
                  aria-pressed={detail.is_favourite}
                  aria-label={detail.is_favourite ? 'Remove from favourites' : 'Add to favourites'}
                >
                  <Heart size={20} fill={detail.is_favourite ? 'currentColor' : 'none'} />
                </button>
              </div>
              <dl className="br-facts">
                {detail.default_key && (<><dt>Key</dt><dd>{detail.default_key}</dd></>)}
                {detail.ccli_number && (<><dt>CCLI</dt><dd>{detail.ccli_number}</dd></>)}
                {detail.bible_references && (<><dt>Bible</dt><dd>{detail.bible_references}</dd></>)}
                {detail.copyright_info && (<><dt>Copyright</dt><dd>{detail.copyright_info}</dd></>)}
              </dl>
              {detail.tags.length > 0 && (
                <div className="lt-row-tags">
                  {detail.tags.map((t) => <span key={t} className="tag-chip">{t}</span>)}
                </div>
              )}
              {detail.videos.length > 0 && (
                <>
                  <h3 className="lt-panel-heading">Listen</h3>
                  <ul className="lt-file-list">
                    {detail.videos.map((v) => (
                      <li key={v.url}><a href={v.url} target="_blank" rel="noreferrer">{v.label || 'Link'} ↗</a></li>
                    ))}
                  </ul>
                </>
              )}
              {detail.free ? (
                <>
                  {detail.files.length > 0 && (
                    <>
                      <h3 className="lt-panel-heading">Download</h3>
                      <ul className="lt-file-list">
                        {detail.files.map((f) => (
                          <li key={f.id}>
                            <a href={f.url} target="_blank" rel="noreferrer">
                              {f.label || f.file_type}{f.key_of ? ` (${f.key_of})` : ''} ↓
                            </a>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {detail.lyrics && (
                    <>
                      <h3 className="lt-panel-heading">Lyrics</h3>
                      <div className="lt-lyrics"><LyricsDisplay lyrics={detail.lyrics} /></div>
                    </>
                  )}
                </>
              ) : (
                <div className="br-locked">
                  This song is in copyright, so lyrics and music aren&apos;t part of free browsing. Churches on SongStack add it
                  to their own library and attach music under their own CCLI licence.
                  {!churchName && <> <a href="/onboarding" className="link-brand">Set up your church</a>.</>}
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
