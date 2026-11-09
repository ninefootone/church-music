'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { CategoryBadge, KeyBadge, SampleBadge } from '@/components/ui/badges'
import { PlaylistIcon } from '@/components/ui/PlaylistIcon'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'
import { isOnFreePlan } from '@/lib/freePlan'
import { planTimeLabel } from '@/lib/planTimes'

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
  const [pendingDeletePlaylist, setPendingDeletePlaylist] = useState<any | null>(null)
  const fetchedRef = useRef(false)
  // One-off note about the sample songs/plan seeded into new churches (utils/sampleContent.js).
  const [hasSampleSongs, setHasSampleSongs] = useState(false)
  const [samplePlan, setSamplePlan] = useState<any | null>(null)
  const [sampleNoticeDismissed, setSampleNoticeDismissed] = useState(true)
  const sampleNoticeKey = church ? `songstack_sample_notice_dismissed_${church.id}` : ''

  useEffect(() => {
    if (!sampleNoticeKey) return
    try {
      setSampleNoticeDismissed(localStorage.getItem(sampleNoticeKey) === 'true')
    } catch {
      setSampleNoticeDismissed(false)
    }
  }, [sampleNoticeKey])

  const dismissSampleNotice = () => {
    try { localStorage.setItem(sampleNoticeKey, 'true') } catch {}
    setSampleNoticeDismissed(true)
  }

  // iPad app promo: dismissed per browser (it's about the person, not the church)
  const [ipadPromoDismissed, setIpadPromoDismissed] = useState(true)
  useEffect(() => {
    try { setIpadPromoDismissed(localStorage.getItem('songstack_ipad_promo_dismissed') === 'true') }
    catch { setIpadPromoDismissed(false) }
  }, [])
  const dismissIpadPromo = () => {
    try { localStorage.setItem('songstack_ipad_promo_dismissed', 'true') } catch {}
    setIpadPromoDismissed(true)
  }

  useEffect(() => {
    if (!church || fetchedRef.current) return
    fetchedRef.current = true
    Promise.all([
      api.get('/api/songs/coming-up', { params: { limit: 4 } }).then(r => {
        setSongs(r.data.songs)
        setHasSampleSongs(r.data.has_sample)
      }),
      api.get('/api/plans', { params: { upcoming: 'true' } }).then(r => {
        setPlans(r.data.slice(0, 4))
        setSamplePlan(r.data.find((p: any) => p.is_sample) ?? null)
      }),
      api.get('/api/plans/my-upcoming', { params: { include_drafts: 'true' } }).then(r => setMyUpcoming(r.data)),
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

  // Runs from the app's ConfirmModal (was the browser's own confirm() popup).
  const deletePlaylist = async (id: number) => {
    try {
      await api.delete(`/api/playlists/${id}`)
      setPlaylists(prev => prev.filter(p => p.id !== id))
    } catch {
      alert('Failed to delete playlist.')
    } finally {
      setPendingDeletePlaylist(null)
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

  const hasMyPlans = myUpcoming.length > 0

  const myUpcomingCard = (
    <div className="card dash-card--mine">
      <div className="card-header-row">
        <span className="section-label">My upcoming plans</span>
        {isAdmin && (
          <Link href="/team" className="btn btn-ghost">Manage team →</Link>
        )}
      </div>
      {myUpcoming.slice(0, 4).map((plan) => {
          const date = parseISO(plan.plan_date)
          const rowInner = (
            <>
              <div className="dash-row-content">
                <p className="dash-row-title">
                  {format(date, 'd MMM yyyy')}{planTimeLabel(plan) ? ` · ${planTimeLabel(plan)}` : ''}
                </p>
                {plan.title && <p className="dash-row-meta">{plan.title}</p>}
                {plan.musician_roles && <p className="dash-row-meta">{plan.musician_roles}</p>}
                {!plan.can_open && <p className="dash-row-meta dash-row-meta--italic">Pencilled in · details to follow</p>}
              </div>
              {plan.status === 'draft' && <span className="badge badge-draft">DRAFT</span>}
              <span className={`badge ${isToday(plan.plan_date) ? 'badge-today' : 'badge-upcoming'}`}>
                {isToday(plan.plan_date) ? 'TODAY' : 'UPCOMING'}
              </span>
            </>
          )
          // Drafts a member can't open (not admin / Add & edit plans) show without a link
          return plan.can_open
            ? <Link key={plan.id} href={`/plans/${plan.id}`} className="dash-row">{rowInner}</Link>
            : <div key={plan.id} className="dash-row dash-row--static">{rowInner}</div>
        })}
      <div className="card-footer card-footer--split">
        <Link href="/availability" className="btn btn-ghost">Manage my availability →</Link>
        {myUpcoming.length > 4 && <Link href="/plans" className="btn btn-ghost">All plans →</Link>}
      </div>
    </div>
  )

  const songsCard = (
    <div className="card dash-card--songs">
      <div className="card-header-row">
        <span className="section-label">Coming up in plans</span>
        {canManageSongs && <Link href="/songs/new" className="btn btn-ghost">Add new song +</Link>}
      </div>
      {songs.length === 0 ? (
        <p className="text-muted">No songs in upcoming plans yet.{canAddPlans && <> <Link href="/plans/new" className="link">Add a plan</Link></>}</p>
      ) : songs.map((song) => (
        <Link key={song.id} href={`/songs/${song.id}`} className="dash-row">
          <div className="dash-row-content">
            <p className="dash-row-title">{song.title}</p>
            <div className="dash-row-body">
              {song.first_line && (
                <span className="dash-row-meta dash-row-meta--italic">{song.first_line}</span>
              )}
              <div className="song-row-badges-mobile">
                {song.plan_key && <KeyBadge keyOf={song.plan_key} />}
                {song.category && <CategoryBadge category={song.category} />}
                {song.is_sample && <SampleBadge />}
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
            {song.plan_key && <KeyBadge keyOf={song.plan_key} />}
            {song.category && <CategoryBadge category={song.category} />}
            {song.is_sample && <SampleBadge />}
          </div>
        </Link>
      ))}
      <div className="card-footer card-footer--split">
        <Link href="/songs" className="btn btn-ghost">View all songs →</Link>
        <Link href="/stats" className="btn btn-ghost">Song stats →</Link>
      </div>
    </div>
  )

  const allPlansCard = (
    <div className="card dash-card--all">
      <div className="card-header-row">
        <span className="section-label">All upcoming plans</span>
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
                {format(date, 'd MMM')}{planTimeLabel(plan) ? ` · ${planTimeLabel(plan)}` : ''}
              </p>
              {plan.title && <p className="dash-row-meta">{plan.title}</p>}
            </div>
            {plan.is_sample && <SampleBadge upper />}
            {plan.status === 'draft' && <span className="badge badge-draft">DRAFT</span>}
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
  )

  const playlistsCard = (
    <div className="card dash-card--playlists">
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
                <button className="btn btn-ghost btn-danger-text" onClick={() => setPendingDeletePlaylist(p)}>Delete</button>
              </div>
            )}
          </div>
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div>
      {isAdmin && isOnFreePlan(church) && (
        <div className="card dash-upgrade-banner">
          <div className="dash-upgrade-inner">
            <div>
              <p className="dash-card-heading">You're on the free plan</p>
              <p className="dash-card-subtext">Limited to 5 songs and 1 plan. Upgrade to unlock everything.</p>
            </div>
            <div className="dash-upgrade-actions">
              <button onClick={() => handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!)} className="btn btn-ghost">
                £10 / month
              </button>
              <button onClick={() => handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL!)} className="btn btn-primary">
                £100 / year
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && !sampleNoticeDismissed && (hasSampleSongs || samplePlan) && (
        <div className="card dash-sample-notice">
          <div className="dash-sample-notice-inner">
            <div className="dash-sample-notice-text">
              <p className="dash-card-heading">We&apos;ve added some examples to get you started</p>
              <p className="dash-card-subtext">
                {hasSampleSongs && <>Your library has three sample songs, shared with permission from Joyful Noise, Awesome Cutlery and Ben Slee Music. </>}
                {samplePlan && <>There&apos;s also a sample plan for {format(parseISO(samplePlan.plan_date), 'd MMMM')} showing how a service comes together. </>}
                {isOnFreePlan(church)
                  ? <>They don&apos;t count towards your free plan&apos;s 5 songs and 1 plan, so you can still add your own. Edit or delete them whenever you like.</>
                  : <>Edit or delete them whenever you like.</>}
              </p>
            </div>
            <div className="dash-sample-notice-actions">
              {samplePlan && <Link href={`/plans/${samplePlan.id}`} className="btn btn-ghost">View sample plan</Link>}
              <button type="button" onClick={dismissSampleNotice} className="btn btn-primary">Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* Not on any upcoming plans: slim strip instead of an empty card */}
      {!loading && !hasMyPlans && (
        <div className="card dash-my-empty">
          <p className="dash-my-empty-text"><strong>My upcoming plans</strong> · You&apos;re not on any upcoming plans yet.</p>
          <Link href="/availability" className="btn btn-ghost">Manage my availability →</Link>
        </div>
      )}

      {/* Desktop: My upcoming (2fr) | Songs (3fr), then All upcoming (3fr) | Playlists (2fr).
          Mobile: rows flatten and cards reorder via CSS — My upcoming, All upcoming, Songs, Playlists. */}
      <div className="dashboard-cards">
        <div className="dashboard-row dashboard-row--narrow-first">
          {hasMyPlans ? myUpcomingCard : allPlansCard}
          {songsCard}
        </div>
        <div className={`dashboard-row dashboard-row--wide-first${hasMyPlans ? '' : ' dashboard-row--single'}`}>
          {hasMyPlans && allPlansCard}
          {playlistsCard}
        </div>
      </div>

      {/* iPad app promo: below the cards so it never pushes plans down */}
      {!loading && !ipadPromoDismissed && (
        <div className="card dash-sample-notice dash-app-promo">
          <div className="dash-sample-notice-inner">
            <div className="dash-sample-notice-text">
              <p className="dash-card-heading">SongStack for iPad</p>
              <p className="dash-card-subtext">
                Take your plans onto the stage. Download sets for rooms with no signal, change key and capo, and mark up your music with Apple Pencil.
              </p>
            </div>
            <div className="dash-sample-notice-actions">
              <a href="https://apps.apple.com/app/apple-store/id6816034031?pt=129467903&ct=web-dashboard&mt=8" target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                Get it on the App Store
              </a>
              <button type="button" onClick={dismissIpadPromo} className="btn-text">Dismiss</button>
            </div>
          </div>
        </div>
      )}

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
      {pendingDeletePlaylist && (
        <ConfirmModal
          title="Delete playlist"
          message={`Delete “${pendingDeletePlaylist.name}”? This removes the link from your dashboard; the playlist itself isn't affected.`}
          confirmLabel="Delete playlist"
          danger
          onConfirm={() => deletePlaylist(pendingDeletePlaylist.id)}
          onCancel={() => setPendingDeletePlaylist(null)}
        />
      )}
    </div>
  )
}
