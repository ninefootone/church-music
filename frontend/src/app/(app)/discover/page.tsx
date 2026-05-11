'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useChurch } from '@/context/ChurchContext'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
import api, { setAuthToken } from '@/lib/api'
import { Sparkles, BookOpen, Youtube, Music } from 'lucide-react'

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
  )
}

export default function DiscoverPage() {
  const { getToken } = useAuth()
  const { church, loading: churchLoading } = useChurch()
  const [songs, setSongs] = useState<DiscoverSong[]>([])
  const [loading, setLoading] = useState(true)
  const [importStates, setImportStates] = useState<Record<string, ImportState>>({})
  const [importedIds, setImportedIds] = useState<Record<string, string>>({})
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!church || fetchedRef.current) return
    fetchedRef.current = true
    Promise.all([
      api.get('/api/templates/discover'),
      api.get('/api/songs'),
    ]).then(([discoverRes, songsRes]) => {
      setSongs(discoverRes.data)
      const existingTitles: Record<string, string> = {}
      for (const s of songsRes.data) {
        existingTitles[s.title.toLowerCase()] = s.id
      }
      const preloaded: Record<string, ImportState> = {}
      const preloadedIds: Record<string, string> = {}
      for (const ds of discoverRes.data) {
        const match = existingTitles[ds.title.toLowerCase()]
        if (match) {
          preloaded[ds.id] = 'exists'
          preloadedIds[ds.id] = match
        }
      }
      setImportStates(preloaded)
      setImportedIds(preloadedIds)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [church])

  const handleImport = async (song: DiscoverSong) => {
    setImportStates(s => ({ ...s, [song.id]: 'loading' }))
    try {
      const token = await getToken()
      setAuthToken(token)
      const { data } = await api.post(`/api/templates/${song.id}/import`)
      setImportedIds(s => ({ ...s, [song.id]: data.id }))
      setImportStates(s => ({ ...s, [song.id]: 'done' }))
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

  if (churchLoading || loading) return <p className="text-muted dash-loading">Loading…</p>

  return (
    <div className="page-constrained">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Discover</h1>
          <p className="page-subtitle">Curated songs from the Song Stack library. Add any song to your church library in one tap.</p>
        </div>
      </div>

      {songs.length === 0 ? (
        <div className="empty-state">
          <Sparkles size={32} className="empty-state-icon" />
          <p>No songs in Discover yet. Check back soon.</p>
        </div>
      ) : (
        <div className="discover-list">
          {songs.map(song => {
            const state = importStates[song.id] || 'idle'
            const importedSongId = importedIds[song.id]

            return (
              <div key={song.id} className="discover-card">
                {song.discover_image_url ? (
                  <img src={song.discover_image_url} alt={song.title} className="discover-card__image" />
                ) : (
                  <div className="discover-card__image discover-card__image--placeholder">
                    <BookOpen size={24} />
                  </div>
                )}
                <div className="discover-card__body">
                  <div className="discover-card__meta">
                    {song.category && <CategoryBadge category={song.category as any} />}
                    {song.default_key && <KeyBadge keyOf={song.default_key} />}
                  </div>
                  <h2 className="discover-card__title">{song.title}</h2>
                  {song.author && <p className="discover-card__author">{song.author}</p>}
                  {song.discover_description && (
                    <p className="discover-card__description">{song.discover_description}</p>
                  )}
                  {(song.videos || []).some(v => v.link_type === 'youtube' || v.link_type === 'spotify' || v.link_type === 'apple_music') && (
                    <p className="discover-card__links-label">Listen / Watch</p>
                  )}
                  <VideoLinks videos={song.videos || []} />
                  <div className="discover-card__footer">
                    {state === 'idle' && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleImport(song)}>
                        Add to library
                      </button>
                    )}
                    {state === 'loading' && (
                      <button className="btn btn-primary btn-sm" disabled>Adding…</button>
                    )}
                    {(state === 'done' || state === 'exists') && (
                      <div className="discover-card__added">
                        <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                          {state === 'exists' ? 'Already in your library' : '✓ Added'}
                        </span>
                        {importedSongId && (
                          <a href={`/songs/${importedSongId}`} className="btn btn-secondary btn-sm">
                            {!song.share_all_data ? 'Edit to add lyrics & files →' : 'View song →'}
                          </a>
                        )}
                      </div>
                    )}
                    {state === 'error' && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-danger)' }}>
                        Failed — try again
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}