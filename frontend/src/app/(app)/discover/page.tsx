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
            {isSpotify && <Music size={13} />}
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
    api.get('/api/templates/discover')
      .then(r => setSongs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
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
                  {song.tags && song.tags.length > 0 && (
                    <div className="discover-card__tags">
                      {song.tags.map(tag => (
                        <span key={tag} className="tag-chip">{tag}</span>
                      ))}
                    </div>
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