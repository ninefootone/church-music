'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CategoryBadge } from '@/components/ui/badges'
import { Category } from '@/types'

const periods = [
  { label: '1 month', value: 30 },
  { label: '3 months', value: 90 },
  { label: '1 year', value: 365 },
]

const topSongs = [
  { rank: 1,  id: '1', title: '10,000 Reasons (Bless The Lord)', author: 'Jonas Myrin, Matt Redman', category: 'praise' as Category,     count: 8,  last_sung: '1 Mar 2026' },
  { rank: 2,  id: '2', title: 'In Christ Alone',                  author: 'Keith Getty, Stuart Townend', category: 'assurance' as Category, count: 6,  last_sung: '15 Feb 2026' },
  { rank: 3,  id: '3', title: 'How Great Is Your Faithfulness',   author: 'Thomas Chisholm',             category: 'praise' as Category,    count: 5,  last_sung: '8 Mar 2026' },
  { rank: 4,  id: '4', title: 'Yet Not I But Through Christ In Me', author: 'CityAlight',               category: 'response' as Category,  count: 5,  last_sung: '1 Mar 2026' },
  { rank: 5,  id: '5', title: 'Before The Throne Of God Above',   author: 'Charitie Bancroft',           category: 'assurance' as Category, count: 4,  last_sung: '12 Jan 2026' },
  { rank: 6,  id: '6', title: 'Come Thou Fount',                  author: 'Robert Robinson',             category: 'response' as Category,  count: 3,  last_sung: '1 Feb 2026' },
  { rank: 7,  id: '7', title: 'Great Is Thy Faithfulness',        author: 'Thomas Chisholm',             category: 'praise' as Category,    count: 3,  last_sung: '3 Nov 2025' },
  { rank: 8,  id: '8', title: 'O Praise The Name',                author: 'Hillsong Worship',            category: 'praise' as Category,    count: 2,  last_sung: '15 Mar 2026' },
]

const categoryBreakdown = [
  { category: 'praise' as Category, count: 21, pct: 40 },
  { category: 'assurance' as Category, count: 13, pct: 25 },
  { category: 'response' as Category, count: 8, pct: 15 },
  { category: 'communion' as Category, count: 5, pct: 10 },
  { category: 'confession' as Category, count: 3, pct: 6 },
  { category: 'sending' as Category, count: 2, pct: 4 },
]

export default function StatsPage() {
  const [period, setPeriod] = useState(365)
  const maxCount = Math.max(...topSongs.map(s => s.count))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 className="page-title">Stats</h1>
        <div style={{ display: 'flex', background: 'var(--color-brand-50)', borderRadius: '8px', padding: 3, gap: 2 }}>
          {periods.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                padding: '5px 14px', borderRadius: '6px', border: 'none', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all var(--transition-fast)',
                background: period === p.value ? 'var(--color-surface)' : 'transparent',
                color: period === p.value ? 'var(--color-brand-600)' : 'var(--color-text-secondary)',
                boxShadow: period === p.value ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '16px' }}>
        {[
          { value: 18, label: 'Services' },
          { value: 52, label: 'Song slots used' },
          { value: 34, label: 'Unique songs sung' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--color-brand-600)', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 4 }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Most sung */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <span className="section-label" style={{ display: 'block', marginBottom: '16px' }}>Most sung songs</span>
        {topSongs.map((song, i) => (
          <div key={song.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < topSongs.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', width: 20, textAlign: 'right', flexShrink: 0 }}>{song.rank}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Link href={`/songs/${song.id}`} style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {song.title}
                </Link>
                <CategoryBadge category={song.category} />
              </div>
              {/* Bar chart */}
              <div style={{ height: 6, background: 'var(--color-neutral-100)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(song.count / maxCount) * 100}%`, background: 'var(--color-brand-400)', borderRadius: '999px', transition: 'width 0.4s ease' }} />
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-brand-600)', flexShrink: 0, width: 16, textAlign: 'right' }}>{song.count}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0, width: 90, textAlign: 'right' }}>{song.last_sung}</div>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div className="card">
        <span className="section-label" style={{ display: 'block', marginBottom: '16px' }}>Category breakdown</span>
        {categoryBreakdown.map((cat, i) => (
          <div key={cat.category} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: i < categoryBreakdown.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
            <div style={{ width: 80, flexShrink: 0 }}><CategoryBadge category={cat.category} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 8, background: 'var(--color-neutral-100)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${cat.pct}%`, background: 'var(--color-brand-300, var(--color-brand-400))', borderRadius: '999px' }} />
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', flexShrink: 0, width: 60, textAlign: 'right' }}>{cat.count} times ({cat.pct}%)</div>
          </div>
        ))}
      </div>
    </div>
  )
}
