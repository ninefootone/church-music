'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { CategoryBadge } from '@/components/ui/badges'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'
import { Category } from '@/types'

export default function StatsPage() {
  const { church } = useChurch()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(365)

  useEffect(() => {
    if (!church) return
    setLoading(true)
    api.get('/api/stats', { params: { period } })
      .then(r => setStats(r.data))
      .catch(err => console.error('Failed to fetch stats:', err))
      .finally(() => setLoading(false))
  }, [church, period])

  const exportCCLI = async () => {
    try {
      const { data } = await api.get('/api/stats/ccli-export', { params: { period } })
      if (!data || data.length === 0) { alert('No CCLI data to export for this period.'); return }

      const churchName = church?.name || 'Unknown Church'
      const ccliNumber = church?.ccli_number || 'Not set'
      const exportDate = format(new Date(), 'dd/MM/yyyy')
      const periodLabel = period === 365 ? '1 year' : `${period} days`

      const header = [
        [`Church: ${churchName}`],
        [`CCLI Licence Number: ${ccliNumber}`],
        [`Export date: ${exportDate}`],
        [`Reporting period: Last ${periodLabel}`],
        [],
        ['CCLI Song Number', 'Song Title', 'Author', 'Times Used', 'Last Used'],
      ]

      const rows = data.map((s: any) => [
        s.ccli_number || '',
        s.title,
        s.author || '',
        s.times_used,
        s.last_used ? format(parseISO(s.last_used), 'dd/MM/yyyy') : '',
      ])

      const allRows = [...header, ...rows]
      const csv = allRows.map((r: any) => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')

      const filename = church?.ccli_number
        ? `CCLI-${church.ccli_number}-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
        : `ccli-report-${format(new Date(), 'yyyy-MM-dd')}.csv`

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch (err) { console.error('Export failed:', err) }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Stats</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {[30, 90, 365].map(p => (
            <button key={p} className={`filter-chip ${period === p ? 'is-active' : ''}`} onClick={() => setPeriod(p)}>
              {p === 365 ? '1 year' : `${p} days`}
            </button>
          ))}
          <button onClick={exportCCLI} className="btn btn-secondary btn-sm">Export CCLI CSV</button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-xl)' }}>Loading…</div>
      ) : !stats ? (
        <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-xl)' }}>No data yet.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="stat-number">{stats.total_songs}</div>
              <div className="stat-label">Songs in library</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="stat-number">{stats.total_services}</div>
              <div className="stat-label">Services in last {period === 365 ? 'year' : `${period} days`}</div>
            </div>
          </div>

          <div className="card">
            <div className="section-label">Most sung songs</div>
            {!stats.top_songs || stats.top_songs.length === 0 ? (
              <div style={{ fontSize: 15, color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-lg)' }}>
                No services recorded yet. Add songs to services to see stats here.
              </div>
            ) : stats.top_songs.map((song: any, i: number) => (
              <div key={song.song_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i < stats.top_songs.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-brand-200)', width: 36, textAlign: 'center', flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div className="song-title">{song.title}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="stat-number" style={{ fontSize: 20 }}>{song.times_sung}</div>
                  <div className="stat-label">times</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
