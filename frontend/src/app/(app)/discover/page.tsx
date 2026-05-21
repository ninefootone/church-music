'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useChurch } from '@/context/ChurchContext'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
import api, { setAuthToken } from '@/lib/api'
import { Sparkles, Youtube, Music, GripVertical, Search, X, ChevronRight } from 'lucide-react'
import { CATEGORIES } from '@/types'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type DiscoverSong = {
  id: string
  title: string
  author: string
  default_key: string | null
  category: string | null
  first_line: string | null
  ccli_number: string | null
  discover_description: string | null
  discover_image_url: string | null
  share_all_data: boolean
  tags: string[]
  videos: { url: string; label: string | null; link_type: string | null }[]
}

type LibrarySong = {
  id: string
  title: string
  author: string | null
  default_key: string | null
  category: string | null
  first_line: string | null
  ccli_number: string | null
  copyright_info: string | null
  share_all_data: boolean
  tags: string[]
}

type ImportState = 'idle' | 'loading' | 'done' | 'exists' | 'error'

function SpotifyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  )
}

function VideoLinks({ videos }: { videos: DiscoverSong['videos'] }) {
  const relevant = videos.filter(v => v.link_type === 'youtube' || v.link_type === 'spotify' || v.link_type === 'apple_music')
  if (relevant.length === 0) return null
  return (
    <>
      <p className="discover-card__links-label">Listen / Watch</p>
      <div className="discover-card__links">
        {relevant.map((v, i) => {
          const isYoutube = v.link_type === 'youtube'
          const isSpotify = v.link_type === 'spotify'
          return (
            <a key={i} href={v.url} target="_blank" rel="noopener noreferrer" className="discover-card__link-btn">
              {isYoutube && <Youtube size={13} />}
              {isSpotify && <SpotifyIcon />}
              {!isYoutube && !isSpotify && <Music size={13} />}
              {v.label || (isYoutube ? 'YouTube' : isSpotify ? 'Spotify' : 'Listen')}
            </a>
          )
        })}
      </div>
    </>
  )
}

function SortableCard({
  song,
  isMasterLibrary,
  canManageSongs,
  importState,
  importedSongId,
  onImport,
  onDiscoverToggle,
  togglingDiscover,
}: {
  song: DiscoverSong
  isMasterLibrary: boolean
  canManageSongs: boolean
  importState: ImportState
  importedSongId: string | undefined
  onImport: (song: DiscoverSong) => void
  onDiscoverToggle: (song: DiscoverSong) => void
  togglingDiscover: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="discover-card">
      {isMasterLibrary && (
        <div className="discover-card__drag-handle" {...attributes} {...listeners}>
          <GripVertical size={16} />
        </div>
      )}
      <img
        src={song.discover_image_url || '/discover-fallback.jpg'}
        alt={song.title}
        className="discover-card__image"
      />
      <div className="discover-card__body">
        <h2 className="discover-card__title">{song.title}</h2>
        {song.author && <p className="discover-card__author">{song.author}</p>}
        {song.discover_description && (
          <p className="discover-card__description">{song.discover_description}</p>
        )}
        <div className="discover-card__meta">
          {song.category && <CategoryBadge category={song.category as any} />}
          {song.default_key && <KeyBadge keyOf={song.default_key} />}
          {song.share_all_data && (
            <span className="discover-card__files-badge">Lyrics &amp; Files Included</span>
          )}
        </div>
        <VideoLinks videos={song.videos || []} />
        <div className="discover-card__footer">
          <div>
            {!canManageSongs && importState !== 'done' && importState !== 'exists' && (
              <span className="text-muted text-sm">Ask an admin to add this song</span>
            )}
            {canManageSongs && importState === 'idle' && (
              <button className="btn btn-primary btn-sm" onClick={() => onImport(song)}>
                Add to library
              </button>
            )}
            {canManageSongs && importState === 'loading' && (
              <button className="btn btn-primary btn-sm" disabled>Adding…</button>
            )}
            {(importState === 'done' || importState === 'exists') && (
              <div className="discover-card__added">
                <span className="text-muted text-sm">
                  {importState === 'exists' ? 'Already in your library' : '✓ Added'}
                </span>
                {importedSongId && (
                  <a href={`/songs/${importedSongId}`} className="btn btn-secondary btn-sm">
                    {!song.share_all_data ? 'Edit to add lyrics & files →' : 'View song →'}
                  </a>
                )}
              </div>
            )}
            {canManageSongs && importState === 'error' && (
              <span className="text-sm text-danger">
                Failed — try again
              </span>
            )}
          </div>
          {isMasterLibrary && (
            <button
              className="discover-card__hide-btn"
              onClick={() => onDiscoverToggle(song)}
              disabled={togglingDiscover}
            >
              Remove from Discover
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function LibraryRow({
  song,
  canManageSongs,
  importState,
  importedSongId,
  onImport,
}: {
  song: LibrarySong
  canManageSongs: boolean
  importState: ImportState
  importedSongId: string | undefined
  onImport: (song: LibrarySong) => void
}) {
  return (
    <div className="library-row">
      <div className="library-row__content">
        <div className="library-row__title">{song.title}</div>
        <div className="library-row__meta">
          {!canManageSongs && importState !== 'done' && importState !== 'exists' && (
            <span className="text-muted text-sm">Ask an admin to add</span>
          )}
          {song.author && <span className="library-row__author">{song.author}</span>}
          <div className="library-row__badges">
            {song.default_key && <KeyBadge keyOf={song.default_key} />}
            {song.category && <CategoryBadge category={song.category as any} />}
            {song.share_all_data && <span className="discover-card__files-badge">Files / lyrics included</span>}
          </div>
        </div>
      </div>
      <div className="library-row__action">
        {canManageSongs && importState === 'idle' && (
          <button className="btn btn-primary btn-sm" onClick={() => onImport(song)}>
            Add
          </button>
        )}
        {canManageSongs && importState === 'loading' && (
          <button className="btn btn-primary btn-sm" disabled>Adding…</button>
        )}
        {(importState === 'done' || importState === 'exists') && (
          <div className="library-row__added">
            {importedSongId ? (
              <a href={`/songs/${importedSongId}`} className="btn btn-secondary btn-sm">
                {importState === 'exists' ? 'In library →' : '✓ Added →'}
              </a>
            ) : (
              <span className="text-muted text-sm">
                {importState === 'exists' ? 'Already in library' : '✓ Added'}
              </span>
            )}
          </div>
        )}
        {canManageSongs && importState === 'error' && (
          <span className="text-sm text-danger">Failed</span>
        )}
      </div>
    </div>
  )
}

export default function DiscoverPage() {
  const { getToken } = useAuth()
  const { church, loading: churchLoading, canManageSongs } = useChurch()
  const isMasterLibrary = church?.id === process.env.NEXT_PUBLIC_MASTER_CHURCH_ID

  // Carousel state
  const [songs, setSongs] = useState<DiscoverSong[]>([])
  const [carouselLoading, setCarouselLoading] = useState(true)
  const [importStates, setImportStates] = useState<Record<string, ImportState>>({})
  const [importedIds, setImportedIds] = useState<Record<string, string>>({})
  const [savingOrder, setSavingOrder] = useState(false)
  const [togglingDiscover, setTogglingDiscover] = useState<Record<string, boolean>>({})
  const fetchedRef = useRef(false)

  // Library state
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryCategory, setLibraryCategory] = useState<string>('all')
  const [librarySongs, setLibrarySongs] = useState<LibrarySong[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryPage, setLibraryPage] = useState(1)
  const [libraryTotal, setLibraryTotal] = useState(0)
  const [libraryPages, setLibraryPages] = useState(1)
  const [libraryImportStates, setLibraryImportStates] = useState<Record<string, ImportState>>({})
  const [libraryImportedIds, setLibraryImportedIds] = useState<Record<string, string>>({})
  const [churchSongTitles, setChurchSongTitles] = useState<Record<string, string>>({})
  const librarySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sensors = useSensors(useSensor(PointerSensor))

  // Load carousel + church songs on mount
  useEffect(() => {
    if (!church || fetchedRef.current) return
    fetchedRef.current = true
    Promise.all([
      api.get('/api/templates/discover'),
      api.get('/api/songs'),
    ]).then(([discoverRes, songsRes]) => {
      setSongs(discoverRes.data)
      const titleMap: Record<string, string> = {}
      for (const s of songsRes.data) {
        titleMap[s.title.toLowerCase()] = s.id
      }
      setChurchSongTitles(titleMap)
      const preloaded: Record<string, ImportState> = {}
      const preloadedIds: Record<string, string> = {}
      for (const ds of discoverRes.data) {
        const match = titleMap[ds.title.toLowerCase()]
        if (match) {
          preloaded[ds.id] = 'exists'
          preloadedIds[ds.id] = match
        }
      }
      setImportStates(preloaded)
      setImportedIds(preloadedIds)
    }).catch(() => {}).finally(() => setCarouselLoading(false))
  }, [church])

  // Fetch library results
  const fetchLibrary = useCallback(async (search: string, category: string, page: number) => {
    setLibraryLoading(true)
    try {
      const params: Record<string, string> = { page: String(page) }
      if (search) params.q = search
      if (category !== 'all') params.category = category
      const { data } = await api.get('/api/templates/library', { params })
      setLibrarySongs(data.songs)
      setLibraryTotal(data.total)
      setLibraryPages(data.pages)
      // Pre-mark songs already in church library
      const states: Record<string, ImportState> = {}
      const ids: Record<string, string> = {}
      for (const s of data.songs) {
        const match = churchSongTitles[s.title.toLowerCase()]
        if (match) {
          states[s.id] = 'exists'
          ids[s.id] = match
        }
      }
      setLibraryImportStates(prev => ({ ...states, ...prev }))
      setLibraryImportedIds(prev => ({ ...ids, ...prev }))
    } catch {} finally {
      setLibraryLoading(false)
    }
  }, [churchSongTitles])

  // Initial library load once church songs are loaded
  useEffect(() => {
    if (!church || carouselLoading) return
    fetchLibrary('', 'all', 1)
  }, [church, carouselLoading])

  // Debounced search
  useEffect(() => {
    if (librarySearchTimer.current) clearTimeout(librarySearchTimer.current)
    librarySearchTimer.current = setTimeout(() => {
      setLibraryPage(1)
      fetchLibrary(librarySearch, libraryCategory, 1)
    }, 300)
    return () => { if (librarySearchTimer.current) clearTimeout(librarySearchTimer.current) }
  }, [librarySearch, libraryCategory])

  const handleLibraryPageChange = (page: number) => {
    setLibraryPage(page)
    fetchLibrary(librarySearch, libraryCategory, page)
  }

  const handleDiscoverToggle = async (song: DiscoverSong) => {
    setTogglingDiscover(s => ({ ...s, [song.id]: true }))
    try {
      const token = await getToken()
      setAuthToken(token)
      await api.patch(`/api/songs/${song.id}/discover`, { in_discover: false })
      setSongs(s => s.filter(s => s.id !== song.id))
    } catch {} finally {
      setTogglingDiscover(s => ({ ...s, [song.id]: false }))
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = songs.findIndex(s => s.id === active.id)
    const newIndex = songs.findIndex(s => s.id === over.id)
    const newOrder = arrayMove(songs, oldIndex, newIndex)
    setSongs(newOrder)
    setSavingOrder(true)
    try {
      const token = await getToken()
      setAuthToken(token)
      await api.put('/api/templates/discover/order', { order: newOrder.map(s => s.id) })
    } catch {} finally {
      setSavingOrder(false)
    }
  }

  const handleImport = async (song: DiscoverSong) => {
    setImportStates(s => ({ ...s, [song.id]: 'loading' }))
    try {
      const token = await getToken()
      setAuthToken(token)
      const { data } = await api.post(`/api/templates/${song.id}/import`)
      setImportedIds(s => ({ ...s, [song.id]: data.id }))
      setImportStates(s => ({ ...s, [song.id]: 'done' }))
      setChurchSongTitles(prev => ({ ...prev, [song.title.toLowerCase()]: data.id }))
    } catch (err: any) {
      if (err.response?.status === 409) {
        const existingId = err.response?.data?.existing?.id
        if (existingId) setImportedIds(s => ({ ...s, [song.id]: existingId }))
        setImportStates(s => ({ ...s, [song.id]: 'exists' }))
      } else {
        setImportStates(s => ({ ...s, [song.id]: 'error' }))
      }
    }
  }

  const handleLibraryImport = async (song: LibrarySong) => {
    setLibraryImportStates(s => ({ ...s, [song.id]: 'loading' }))
    try {
      const token = await getToken()
      setAuthToken(token)
      const { data } = await api.post(`/api/templates/${song.id}/import`)
      setLibraryImportedIds(s => ({ ...s, [song.id]: data.id }))
      setLibraryImportStates(s => ({ ...s, [song.id]: 'done' }))
      setChurchSongTitles(prev => ({ ...prev, [song.title.toLowerCase()]: data.id }))
    } catch (err: any) {
      if (err.response?.status === 409) {
        const existingId = err.response?.data?.existing?.id
        if (existingId) setLibraryImportedIds(s => ({ ...s, [song.id]: existingId }))
        setLibraryImportStates(s => ({ ...s, [song.id]: 'exists' }))
      } else {
        setLibraryImportStates(s => ({ ...s, [song.id]: 'error' }))
      }
    }
  }

  if (churchLoading) return <p className="text-muted dash-loading">Loading…</p>

  return (
    <div className="page-constrained">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Discover</h1>
          <p className="discover-subtitle">Curated songs from the Song Stack library. Add any song to your church library in one tap. Some songs include lyrics and files ready to use. Others will need you to add your own or access via SongSelect.</p>
        </div>
      </div>

      {/* Carousel section */}
      {isMasterLibrary && savingOrder && (
        <p className="text-muted text-sm discover-saving">Saving order…</p>
      )}

      {carouselLoading ? (
        <p className="text-muted dash-loading">Loading…</p>
      ) : songs.length === 0 ? (
        <div className="empty-state">
          <Sparkles size={32} className="empty-state-icon" />
          <p>No songs in Discover yet. Check back soon.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={songs.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="discover-list">
              {songs.map(song => (
                <SortableCard
                  key={song.id}
                  song={song}
                  isMasterLibrary={isMasterLibrary}
                  canManageSongs={canManageSongs}
                  importState={importStates[song.id] || 'idle'}
                  importedSongId={importedIds[song.id]}
                  onImport={handleImport}
                  onDiscoverToggle={handleDiscoverToggle}
                  togglingDiscover={!!togglingDiscover[song.id]}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Library section */}
      <div className="library-section">
        <h2 className="library-section__title">Song library</h2>
        <p className="library-section__subtitle">Public domain hymns and songs we have permission to share. Search by title or author and add any to your church library.</p>

        <div className="songs-search-bar">
          <div className="songs-search-wrap">
            <Search size={16} className="songs-search-icon" />
            <input
              className="input songs-search-input"
              type="text"
              placeholder="Search by title or author…"
              value={librarySearch}
              onChange={e => setLibrarySearch(e.target.value)}
            />
            {librarySearch && (
              <button
                className="songs-search-clear"
                onClick={() => setLibrarySearch('')}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="songs-filter-row">
          <button
            className={`filter-chip ${libraryCategory === 'all' ? 'is-active' : ''}`}
            onClick={() => setLibraryCategory('all')}
          >
            All
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              className={`filter-chip ${libraryCategory === cat.value ? 'is-active' : ''}`}
              onClick={() => setLibraryCategory(cat.value)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {libraryLoading ? (
          <p className="text-muted dash-loading">Loading…</p>
        ) : librarySongs.length === 0 ? (
          <div className="songs-table-empty">No songs found.</div>
        ) : (
          <>
            <div className="library-results">
              {librarySongs.map(song => (
                <LibraryRow
                  key={song.id}
                  song={song}
                  canManageSongs={canManageSongs}
                  importState={libraryImportStates[song.id] || 'idle'}
                  importedSongId={libraryImportedIds[song.id]}
                  onImport={handleLibraryImport}
                />
              ))}
            </div>
            {libraryPages > 1 && (
              <div className="library-pagination">
                <span className="library-pagination__count">{libraryTotal} songs</span>
                <div className="library-pagination__buttons">
                  {Array.from({ length: libraryPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => handleLibraryPageChange(p)}
                      className={`library-pagination__btn${p === libraryPage ? ' is-active' : ''}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}