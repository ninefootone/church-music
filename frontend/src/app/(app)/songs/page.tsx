'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Search, Plus, ChevronRight, ArrowUpDown } from 'lucide-react'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
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

  if (churchLoading) return <div className="text-muted" style={{ padding: 'var(--space-xl)' }}>Loading…</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Songs</h1>
        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
          {canManageSongs && (
            <button
              onClick={() => setShowRetired(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontFamily: 'inherit' }}
            >
              {showRetired ? 'Hide retired' : 'Show retired'}
            </button>
          )}
          {canManageSongs && (
            <Link href="/songs/new" className="btn btn-primary" style={{ paddingLeft: 12, paddingRight: 12 }}>
              <Plus size={16} /> Add new
            </Link>
          )}
        </div>
      </div>

      <div style={{ position: 'relative', display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
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
        <div style={{ position: 'relative' }}>
          <button
            className={`btn btn-secondary${sort !== 'title' ? ' is-active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowSortMenu(v => !v)}
          >
            <ArrowUpDown size={15} />
          </button>
          {showSortMenu && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', zIndex: 50, minWidth: 170, overflow: 'hidden' }}>
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
            No songs found.{canManageSongs && <> <Link href="/songs/new" style={{ color: 'var(--color-brand-500)' }}>Add one?</Link></>}
          </div>
        ) : songs.map((song, i) => (
          <Link key={song.id} href={`/songs/${song.id}`} className="song-row" style={song.retired ? { opacity: 0.5 } : undefined}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="song-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
              <div className="song-meta" style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
                {song.first_line && (
                  <span style={{ fontStyle: 'italic' , lineHeight: '1.4em' }}>{song.first_line}</span>
                )}
                <div className="song-row-badges-mobile">
                  {song.default_key && <KeyBadge keyOf={song.default_key} />}
                  {song.category && <CategoryBadge category={song.category} />}
                </div>
                <div style={{ display: 'flex', columnGap: 20 , rowGap: 0 , flexWrap: 'wrap' }}>
                  {song.last_sung && (
                    <span style={{ fontWeight: 400, fontSize: 'var(--text-xs)' }}>
                      <strong style={{ fontWeight: 600 }}>Last sung</strong>{' '}{format(parseISO(song.last_sung as string), 'd MMM yyyy')}
                    </span>
                  )}
                  {song.next_planned && (
                    <span style={{ fontWeight: 400, fontSize: 'var(--text-xs)' }}>
                      <strong style={{ fontWeight: 600 }}>Planned</strong>{' '}{format(parseISO(song.next_planned as string), 'd MMM yyyy')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="song-row-badges-desktop" style={{ gap: 10 }}>
              {song.default_key && <KeyBadge keyOf={song.default_key} />}
              {song.category && <CategoryBadge category={song.category} />}
              <ChevronRight size={18} style={{ color: 'var(--color-text-muted)' }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
