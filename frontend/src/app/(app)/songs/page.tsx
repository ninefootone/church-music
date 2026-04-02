'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Search, Plus, ChevronRight } from 'lucide-react'
import { CategoryBadge } from '@/components/ui/badges'
import { CATEGORIES, Category, Song } from '@/types'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'

export default function SongsPage() {
  const { church, loading: churchLoading, isAdmin } = useChurch()
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all')

  useEffect(() => {
    if (!church) return
    fetchSongs()
  }, [church, search, activeCategory])

  const fetchSongs = async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (activeCategory !== 'all') params.category = activeCategory
      const { data } = await api.get('/api/songs', { params })
      setSongs(data)
    } catch (err) {
      console.error('Failed to fetch songs:', err)
    } finally {
      setLoading(false)
    }
  }

  if (churchLoading) return <div className="text-muted" style={{ padding: 'var(--space-xl)' }}>Loading…</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Songs</h1>
        {isAdmin && (
          <Link href="/songs/new" className="btn btn-primary">
            <Plus size={16} /> Add new song
          </Link>
        )}
      </div>

      <div style={{ position: 'relative', marginBottom: 'var(--space-sm)' }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
        <input
          className="input"
          style={{ paddingLeft: 42 }}
          type="text"
          placeholder="Search by title, author, theme or lyric…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 'var(--space-md)' }}>
        <button className={`filter-chip ${activeCategory === 'all' ? 'is-active' : ''}`} onClick={() => setActiveCategory('all')}>All</button>
        {CATEGORIES.map(cat => (
          <button key={cat.value} className={`filter-chip ${activeCategory === cat.value ? 'is-active' : ''}`} onClick={() => setActiveCategory(cat.value)}>
            {cat.label}
          </button>
        ))}
      </div>

      <div className="songs-table">
        {loading ? (
          <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading songs…</div>
        ) : songs.length === 0 ? (
          <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No songs found.{isAdmin && <> <Link href="/songs/new" style={{ color: 'var(--color-brand-500)' }}>Add one?</Link></>}
          </div>
        ) : songs.map((song, i) => (
          <Link key={song.id} href={`/songs/${song.id}`} className="song-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="song-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
              <div className="song-meta">
                {song.first_line 
                  ? <span style={{ fontStyle: 'italic' }}>{song.first_line}</span>
                  : <span>{song.author}</span>
                }
                {!song.usage?.last_sung && Number(song.usage?.times_planned) > 0 && (
                  <span>Last sung {format(parseISO(song.usage.last_sung), 'd MMM yyyy')}</span>
                )}
                {!song.usage?.last_sung && song.usage?.times_planned > 0 && (
                  <span>Planned</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {song.category && <CategoryBadge category={song.category} />}
              <ChevronRight size={18} style={{ color: 'var(--color-text-muted)' }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
