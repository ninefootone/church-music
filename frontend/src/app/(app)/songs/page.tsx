'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Search, Plus, ChevronRight, ArrowUpDown } from 'lucide-react'
import { CategoryBadge, KeyBadge, RetiredBadge } from '@/components/ui/badges'
import { CATEGORIES, Category, Song } from '@/types'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'

export default function SongsPage() {
  const { church, loading: churchLoading, canManageSongs } = useChurch()
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all')
  const [showRetired, setShowRetired] = useState(false)
  const [sort, setSort] = useState('title')
  const [showSortMenu, setShowSortMenu] = useState(false)

  useEffect(() => {
    if (!church) return
    fetchSongs()
  }, [church, search, activeCategory, showRetired, sort])

  const fetchSongs = async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (activeCategory !== 'all') params.category = activeCategory
      if (showRetired) params.include_retired = 'true'
      if (sort !== 'title') params.sort = sort
      const { data } = await api.get('/api/songs', { params })
      setSongs(data)
    } catch (err) {
      console.error('Failed to fetch songs:', err)
    } finally {
      setLoading(false)
    }
  }

  if (churchLoading) return <div className="text-muted dash-loading">Loading…</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Songs</h1>
        <div className="page-header-actions">
          {canManageSongs && (
            <button
              onClick={() => setShowRetired(v => !v)}
              className="btn-text"
            >
              {showRetired ? 'Hide retired' : 'Show retired'}
            </button>
          )}
          {canManageSongs && (
            <Link href="/songs/new" className="btn btn-primary btn-compact">
              <Plus size={16} /> Add new
            </Link>
          )}
        </div>
      </div>

      <div className="songs-search-bar">
        <div className="songs-search-wrap">
          <Search size={16} className="songs-search-icon" />
          <input
            className="input songs-search-input"
            type="text"
            placeholder="Search by title, author, theme or lyric…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="songs-sort-wrap">
          <button
            className={`btn btn-secondary songs-sort-btn${sort !== 'title' ? ' is-active' : ''}`}
            onClick={() => setShowSortMenu(v => !v)}
          >
            <ArrowUpDown size={15} />
          </button>
          {showSortMenu && (
            <div className="songs-sort-menu">
              {([
                ['title', 'A – Z'],
                ['most_sung', 'Most sung'],
                ['least_sung', 'Least sung'],
                ['recent', 'Recently sung'],
                ['oldest', 'Sung long ago'],
              ] as [string, string][]).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => { setSort(value); setShowSortMenu(false) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: sort === value ? 'var(--color-brand-50)' : 'transparent', color: sort === value ? 'var(--color-brand-600)' : 'var(--color-text)', fontWeight: sort === value ? 600 : 400, fontSize: 'var(--text-sm)', border: 'none', cursor: 'pointer' }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="songs-filter-row">
        <button className={`filter-chip ${activeCategory === 'all' ? 'is-active' : ''}`} onClick={() => setActiveCategory('all')}>All</button>
        {CATEGORIES.map(cat => (
          <button key={cat.value} className={`filter-chip ${activeCategory === cat.value ? 'is-active' : ''}`} onClick={() => setActiveCategory(cat.value)}>
            {cat.label}
          </button>
        ))}
      </div>

      <div className="songs-table">
        {loading ? (
          <div className="songs-table-empty">Loading songs…</div>
        ) : songs.length === 0 ? (
          <div className="songs-table-empty">
            No songs found.{canManageSongs && <> <Link href="/songs/new" className="link">Add one?</Link></>}
          </div>
        ) : songs.map((song, i) => (
          <Link key={song.id} href={`/songs/${song.id}`} className="song-row" style={song.retired ? { opacity: 0.5 } : undefined}>
            <div className="dash-row-content">
              <div className="song-title">{song.title}</div>
              <div className="song-meta song-meta--col">
                {song.first_line && (
                  <span className="dash-row-meta--italic">{song.first_line}</span>
                )}
                <div className="song-row-badges-mobile">
                  {song.default_key && <KeyBadge keyOf={song.default_key} />}
                  {song.category && <CategoryBadge category={song.category} />}
                  {song.retired && <RetiredBadge />}
                </div>
                <div className="dash-row-dates">
                  {song.last_sung && (
                    <span className="dash-row-meta--xs">
                      <strong>Last sung</strong>{' '}{format(parseISO(song.last_sung as string), 'd MMM yyyy')}
                    </span>
                  )}
                  {song.next_planned && (
                    <span className="dash-row-meta--xs">
                      <strong>Planned</strong>{' '}{format(parseISO(song.next_planned as string), 'd MMM yyyy')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="song-row-badges-desktop">
              {song.default_key && <KeyBadge keyOf={song.default_key} />}
              {song.category && <CategoryBadge category={song.category} />}
              {song.retired && <RetiredBadge />}
              <ChevronRight size={18} className="text-muted" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
