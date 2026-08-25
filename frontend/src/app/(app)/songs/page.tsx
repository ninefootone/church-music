'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Search, Plus, ChevronRight, ArrowUpDown, X, Tag } from 'lucide-react'
import { CategoryBadge, KeyBadge, RetiredBadge, DraftBadge } from '@/components/ui/badges'
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
  const [showDraftOnly, setShowDraftOnly] = useState(false)
  const [sort, setSort] = useState('title')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [allTags, setAllTags] = useState<{ id: string; name: string; scope: 'global' | 'church' }[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showTagFilter, setShowTagFilter] = useState(false)
  const isMasterLibrary = church?.id === process.env.NEXT_PUBLIC_MASTER_CHURCH_ID

  useEffect(() => {
    if (!church) return
    fetchSongs()
  }, [church, search, activeCategory, selectedTags, showRetired, showDraftOnly, sort])

  useEffect(() => {
    if (!church) return
    api.get('/api/songs/tags/all').then(res => setAllTags(res.data)).catch(() => {})
  }, [church])

  const fetchSongs = async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (activeCategory !== 'all') params.category = activeCategory
      if (selectedTags.length > 0) params.tags = selectedTags.join(',')
      if (showRetired) params.include_retired = 'true'
      if (showDraftOnly) params.draft_only = 'true'
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
          {canManageSongs && isMasterLibrary && (
            <button
              onClick={() => setShowDraftOnly(v => !v)}
              className={`btn-text${showDraftOnly ? ' is-active' : ''}`}
            >
              {showDraftOnly ? 'All songs' : 'Draft songs'}
            </button>
          )}
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
          {search && (
            <button
              className="songs-search-clear"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
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

      <div className="songs-tagfilter">
        <button
          className={`btn btn-secondary songs-tagfilter-toggle${selectedTags.length ? ' is-active' : ''}`}
          onClick={() => setShowTagFilter(v => !v)}
        >
          <Tag size={15} /> Tags{selectedTags.length > 0 ? ` (${selectedTags.length})` : ''}
        </button>
        {selectedTags.length > 0 && (
          <button className="btn-text" onClick={() => setSelectedTags([])}>Clear tags</button>
        )}
        {showTagFilter && (
          <div className="songs-tagfilter-panel">
            {allTags.length === 0 ? (
              <p className="settings-hint">No tags yet.</p>
            ) : (
              <div className="tag-picker">
                {allTags.map(tag => {
                  const sel = selectedTags.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className={`tag-chip ${sel ? 'tag-chip--selected' : ''}`}
                      onClick={() => setSelectedTags(prev => sel ? prev.filter(t => t !== tag.id) : [...prev, tag.id])}
                    >
                      {tag.name}
                      {sel && <X size={11} className="tag-chip-x" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
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
                  {isMasterLibrary && song.is_draft && <DraftBadge />}
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
              {isMasterLibrary && song.is_draft && <DraftBadge />}
              <ChevronRight size={18} className="text-muted" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
