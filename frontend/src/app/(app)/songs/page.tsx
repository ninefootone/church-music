'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Search, Plus, ChevronRight } from 'lucide-react'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
import { CATEGORIES, Category, Song } from '@/types'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'

export default function SongsPage() {
  const { church, loading: churchLoading } = useChurch()
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

  if (churchLoading) return <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-xl)' }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
        <h1 className="page-title">Songs</h1>
        <Link href="/songs/new" className="btn btn-primary">
          <Plus size={15} /> Add new song
        </Link>
      </div>

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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 'var(--space-md)' }}>
        {['all', ...CATEGORIES.map(c => c.value)].map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat as Category | 'all')}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-border)',
              fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
              background: activeCategory === cat ? 'var(--color-brand-50)' : 'var(--color-surface)',
              color: activeCategory === cat ? 'var(--color-brand-600)' : 'var(--color-text-secondary)',
              borderColor: activeCategory === cat ? 'var(--color-brand-200)' : 'var(--color-border)',
            }}
          >
            {cat === 'all' ? 'All' : CATEGORIES.find(c => c.value === cat)?.label}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {loading ? (
          <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading songs…</div>
        ) : songs.length === 0 ? (
          <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>
            No songs yet. <Link href="/songs/new" style={{ color: 'var(--color-brand-500)' }}>Add your first song</Link>
          </div>
        ) : (
          songs.map((song, i) => (
            <Link
              key={song.id}
              href={`/songs/${song.id}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px var(--space-md)',
                borderBottom: i < songs.length - 1 ? '1px solid var(--color-border)' : 'none',
                textDecoration: 'none', gap: 'var(--space-md)',
                transition: 'background var(--transition-fast)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {song.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{song.author}</span>
                  {song.default_key && <KeyBadge keyOf={song.default_key} />}
                  {song.usage?.last_sung && <span>Last sung {format(new Date(song.usage.last_sung), 'd MMM yyyy')}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {song.category && <CategoryBadge category={song.category} />}
                <ChevronRight size={16} style={{ color: 'var(--color-text-muted)' }} />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
