'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Search, Plus, ChevronRight } from 'lucide-react'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
import { CATEGORIES, Category } from '@/types'

// Placeholder data
const allSongs = [
  { id: '1', title: '10,000 Reasons (Bless The Lord)', author: 'Jonas Myrin, Matt Redman', default_key: 'E', category: 'praise' as Category, last_sung: '2026-03-01', tags: ['Thanksgiving'] },
  { id: '2', title: 'In Christ Alone', author: 'Keith Getty, Stuart Townend', default_key: 'G', category: 'assurance' as Category, last_sung: '2026-02-15', tags: ['Cross', 'Resurrection'] },
  { id: '3', title: 'How Great Is Your Faithfulness', author: 'Thomas Chisholm', default_key: 'D', category: 'praise' as Category, last_sung: '2026-03-08', tags: [] },
  { id: '4', title: 'Yet Not I But Through Christ In Me', author: 'CityAlight', default_key: 'A', category: 'response' as Category, last_sung: '2026-03-01', tags: ['Suffering', 'Hope'] },
  { id: '5', title: 'O Come All Ye Faithful', author: 'Traditional', default_key: 'F', category: 'praise' as Category, last_sung: '2025-12-22', tags: ['Advent', 'Christmas'] },
  { id: '6', title: 'Come Thou Fount', author: 'Robert Robinson', default_key: 'G', category: 'response' as Category, last_sung: '2026-02-01', tags: [] },
  { id: '7', title: 'Before The Throne Of God Above', author: 'Charitie Bancroft', default_key: 'D', category: 'assurance' as Category, last_sung: '2026-01-12', tags: ['Intercession'] },
  { id: '8', title: 'Great Is Thy Faithfulness', author: 'Thomas Chisholm', default_key: 'Bb', category: 'praise' as Category, last_sung: '2025-11-03', tags: [] },
]

export default function SongsPage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all')

  const filtered = allSongs.filter((song) => {
    const matchesSearch =
      search === '' ||
      song.title.toLowerCase().includes(search.toLowerCase()) ||
      song.author.toLowerCase().includes(search.toLowerCase()) ||
      song.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory = activeCategory === 'all' || song.category === activeCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
        <h1 className="page-title">Songs</h1>
        <Link href="/songs/new" className="btn btn-primary">
          <Plus size={15} /> Add new song
        </Link>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 'var(--space-sm)' }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
        <input
          className="input"
          style={{ paddingLeft: 36 }}
          type="text"
          placeholder="Search by title, author, theme or lyric…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Category filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 'var(--space-md)' }}>
        <button
          onClick={() => setActiveCategory('all')}
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--color-border)',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'inherit',
            cursor: 'pointer',
            background: activeCategory === 'all' ? 'var(--color-brand-50)' : 'var(--color-surface)',
            color: activeCategory === 'all' ? 'var(--color-brand-600)' : 'var(--color-text-secondary)',
            borderColor: activeCategory === 'all' ? 'var(--color-brand-200)' : 'var(--color-border)',
            transition: 'all var(--transition-fast)',
          }}
        >
          All
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-border)',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              background: activeCategory === cat.value ? 'var(--color-brand-50)' : 'var(--color-surface)',
              color: activeCategory === cat.value ? 'var(--color-brand-600)' : 'var(--color-text-secondary)',
              borderColor: activeCategory === cat.value ? 'var(--color-brand-200)' : 'var(--color-border)',
              transition: 'all var(--transition-fast)',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Songs list */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>
            No songs found. <Link href="/songs/new" style={{ color: 'var(--color-brand-500)' }}>Add one?</Link>
          </div>
        ) : (
          filtered.map((song, i) => (
            <Link
              key={song.id}
              href={`/songs/${song.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px var(--space-md)',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none',
                textDecoration: 'none',
                gap: 'var(--space-md)',
                transition: 'background var(--transition-fast)',
              }}
              className="song-row-link"
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {song.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{song.author}</span>
                  <KeyBadge keyOf={song.default_key} />
                  {song.last_sung && <span>Last sung {format(new Date(song.last_sung), 'd MMM yyyy')}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <CategoryBadge category={song.category} />
                <ChevronRight size={16} style={{ color: 'var(--color-text-muted)' }} />
              </div>
            </Link>
          ))
        )}
      </div>

      <style jsx>{`
        .song-row-link:hover { background: var(--color-brand-50); }
      `}</style>
    </div>
  )
}
