'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
import { PlaylistIcon } from '@/components/ui/PlaylistIcon'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'

export default function DashboardPage() {
  const { church, loading: churchLoading, isAdmin, canManageSongs, canAddPlans, canManagePlaylists } = useChurch()
  const [songs, setSongs] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [playlists, setPlaylists] = useState<any[]>([])
  const [myUpcoming, setMyUpcoming] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddPlaylist, setShowAddPlaylist] = useState(false)
  const [playlistName, setPlaylistName] = useState('')
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [playlistType, setPlaylistType] = useState('other')
  const [editingPlaylist, setEditingPlaylist] = useState<any | null>(null)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editType, setEditType] = useState('other')
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!church || fetchedRef.current) return
    fetchedRef.current = true
    Promise.all([
      api.get('/api/songs').then(r => setSongs(r.data.slice(0, 4))),
      api.get('/api/plans', { params: { upcoming: 'true' } }).then(r => setPlans(r.data.slice(0, 4))),
      api.get('/api/plans/my-upcoming').then(r => setMyUpcoming(r.data)),
      api.get('/api/playlists').then(r => setPlaylists(r.data)),
    ]).finally(() => setLoading(false))
  }, [church])

  const addPlaylist = async () => {
    if (!playlistName.trim() || !playlistUrl.trim()) return
    try {
      const { data } = await api.post('/api/playlists', { name: playlistName.trim(), url: playlistUrl.trim(), type: playlistType })
      setPlaylists(prev => [...prev, data])
      setPlaylistName('')
      setPlaylistUrl('')
      setPlaylistType('other')
      setShowAddPlaylist(false)
    } catch {
      alert('Failed to add playlist.')
    }
  }

  const saveEdit = async () => {
    if (!editingPlaylist || !editName.trim() || !editUrl.trim()) return
    try {
      const { data } = await api.put(`/api/playlists/${editingPlaylist.id}`, { name: editName.trim(), url: editUrl.trim(), type: editType })
      setPlaylists(prev => prev.map(p => p.id === data.id ? data : p))
      setEditingPlaylist(null)
      setEditType('other')
    } catch {
      alert('Failed to save playlist.')
    }
  }

  const deletePlaylist = async (id: number) => {
    if (!confirm('Delete this playlist?')) return
    try {
      await api.delete(`/api/playlists/${id}`)
      setPlaylists(prev => prev.filter(p => p.id !== id))
    } catch {
      alert('Failed to delete playlist.')
    }
  }

  const isToday = (dateStr: string) => {
    const today = new Date()
    const d = parseISO(dateStr)
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  }

  if (churchLoading || (loading && !songs.length)) return (
    <p className="text-muted dash-loading">Loading…</p>
  )

  const handleUpgrade = async (priceId: string) => {
    if (!church) return
    try {
      const { data } = await api.post('/api/stripe/create-checkout-session', {
        priceId,
        churchId: church.id,
      })
      window.location.href = data.url
    } catch {
      alert('Something went wrong. Please try again.')
    }
  }

  return (
    <div>
      {isAdmin && !church?.free_access && (!church?.subscription_status || church?.subscription_status === 'free') && (
        <div className="card dash-upgrade-banner">
          <div className="dash-upgrade-inner">
            <div>
              <p className="dash-card-heading">You're on the free plan</p>
              <p className="dash-card-subtext">Limited to 5 songs and 1 plan. Upgrade to unlock everything.</p>
            </div>
            <div className="dash-upgrade-actions">
              <button onClick={() => handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!)} className="btn btn-ghost">
                £5 / month
              </button>
              <button onClick={() => handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL!)} className="btn btn-primary">
                £50 / year
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-grid">

        {/* Songs */}
        <div className="card">
          <div className="card-header-row">
            <span className="section-label">Songs</span>
            {canManageSongs && <Link href="/songs/new" className="btn btn-ghost">Add new +</Link>}
          </div>
          {songs.length === 0 ? (
            <p className="text-muted">No songs yet.{canManageSongs && <> <Link href="/songs/new" className="link">Add your first</Link></>}</p>
          ) : songs.map((song) => (
            <Link key={song.id} href={`/songs/${song.id}`} className="dash-row">
              <div className="dash-row-content">
                <p className="dash-row-title">{song.title}</p>
                <div className="dash-row-body">
                  {song.first_line && (
                    <span className="dash-row-meta dash-row-meta--italic">{song.first_line}</span>
                  )}
                  <div className="song-row-badges-mobile">
                    {song.default_key && <KeyBadge keyOf={song.default_key} />}
                    {song.category && <CategoryBadge category={song.category} />}
                  </div>
                  <div className="dash-row-dates">
                    {song.last_sung && (
                      <span className="dash-row-meta dash-row-meta--xs">
                        <strong>Last sung</strong>{' '}{format(parseISO(song.last_sung as string), 'd MMM yyyy')}
                      </span>
                    )}
                    {song.next_planned && (
                      <span className="dash-row-meta dash-row-meta--xs">
                        <strong>Planned</strong>{' '}{format(parseISO(song.next_planned as string), 'd MMM yyyy')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="song-row-badges-desktop">
                {song.default_key && <KeyBadge keyOf={song.default_key} />}
                {song.category && <CategoryBadge category={song.category} />}
              </div>
            </Link>
          ))}
          <div className="card-footer">
            <Link href="/songs" className="btn btn-ghost">View all songs →</Link>
          </div>
        </div>

        {/* Plans — upcoming only */}
        <div className="card">
          <div className="card-header-row">
            <span className="section-label">Plans</span>
            {canAddPlans && <Link href="/plans/new" className="btn btn-ghost">Add new +</Link>}
          </div>
          {plans.length === 0 ? (
            <p className="text-muted">No upcoming plans. {canAddPlans && <Link href="/plans/new" className="link">Add one +</Link>}</p>
          ) : plans.map((plan) => {
            const date = parseISO(plan.plan_date)
            return (
              <Link key={plan.id} href={`/plans/${plan.id}`} className="dash-row">
                <div className="dash-row-content">
                  <p className="dash-row-title">
                    {format(date, 'd MMM')}{plan.plan_time ? ` · ${plan.plan_time}` : ''}
                  </p>
                  {plan.title && <p className="dash-row-meta">{plan.title}</p>}
                </div>
                <span className={`badge ${isToday(plan.plan_date) ? 'badge-today' : 'badge-upcoming'}`}>
                  {isToday(plan.plan_date) ? 'TODAY' : 'UPCOMING'}
                </span>
              </Link>
            )
          })}
          <div className="card-footer">
            <Link href="/plans" className="btn btn-ghost">View all →</Link>
          </div>
        </div>
      </div>

      {/* Add playlist modal */}
      {showAddPlaylist && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-md)' }}>
          <div onClick={() => setShowAddPlaylist(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          <div style={{ position: 'relative', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', width: '100%', maxWidth: 400, boxShadow: 'var(--shadow-md)' }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-md)' }}>Add playlist</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <input className="input" placeholder="Name" value={playlistName} onChange={e => setPlaylistName(e.target.value)} />
              <input className="input" placeholder="URL" value={playlistUrl} onChange={e => setPlaylistUrl(e.target.value)} />
              <select className="input" value={playlistType} onChange={e => setPlaylistType(e.target.value)}>
                <option value="youtube">YouTube</option>
                <option value="spotify">Spotify</option>
                <option value="apple_music">Apple Music</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddPlaylist(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addPlaylist}>Add</button>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-grid-reverse">

        {/* Upcoming */}
        <div className="card">
          <div className="card-header-row">
            <span className="section-label">Upcoming</span>
            {isAdmin && (
              <Link href="/team" className="btn btn-ghost">Manage team →</Link>
            )}
          </div>
          {myUpcoming.length === 0 ? (
            <p className="text-muted">You haven&apos;t been added to any upcoming plans yet.</p>
          ) : (
            myUpcoming.map((plan) => {
              const date = parseISO(plan.plan_date)
              return (
                <Link key={plan.id} href={`/plans/${plan.id}`} className="dash-row">
                  <div className="dash-row-content">
                    <p className="dash-row-title">
                      {format(date, 'd MMM yyyy')}{plan.plan_time ? ` · ${plan.plan_time}` : ''}
                    </p>
                    {plan.title && <p className="dash-row-meta">{plan.title}</p>}
                    {plan.musician_roles && <p className="dash-row-meta">{plan.musician_roles}</p>}
                  </div>
                  <span className={`badge ${isToday(plan.plan_date) ? 'badge-today' : 'badge-upcoming'}`}>
                    {isToday(plan.plan_date) ? 'TODAY' : 'UPCOMING'}
                  </span>
                </Link>
              )
            })
          )}
          <div className="card-footer">
            <Link href="/availability" className="btn btn-ghost">Manage my availability →</Link>
          </div>
        </div>

        {/* Playlists */}
        <div className="card">
          <div className="card-header-row">
            <span className="section-label">Playlists</span>
            {canManagePlaylists && (
              <button className="btn btn-ghost" onClick={() => setShowAddPlaylist(true)}>Add new +</button>
            )}
          </div>
          {playlists.length === 0 && (
            <p className="text-muted">No playlists yet.{canManagePlaylists && ' Add one above.'}</p>
          )}
          {playlists.map(p => (
            <div key={p.id} className="dash-row">
              {editingPlaylist?.id === p.id ? (
                <div className="dash-row-content">
                  <input className="input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name" />
                  <input className="input" value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="URL" style={{ marginTop: '0.4rem' }} />
                  <select className="input" value={editType} onChange={e => setEditType(e.target.value)} style={{ marginTop: '0.4rem' }}>
                    <option value="youtube">YouTube</option>
                    <option value="spotify">Spotify</option>
                    <option value="apple_music">Apple Music</option>
                    <option value="other">Other</option>
                  </select>
                  <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                    <button className="btn btn-ghost" onClick={() => setEditingPlaylist(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="dash-row-content">
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="dash-row-title link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <PlaylistIcon type={p.type || 'other'} size={14} />
                    {p.name}
                  </a>
                {canManagePlaylists && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                    <button className="btn btn-ghost" onClick={() => { setEditingPlaylist(p); setEditName(p.name); setEditUrl(p.url); setEditType(p.type || 'other') }}>Edit</button>
                    <button className="btn btn-ghost" onClick={() => deletePlaylist(p.id)}>Delete</button>
                  </div>
                )}
              </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}