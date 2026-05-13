'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'

export default function DashboardPage() {
  const { church, loading: churchLoading, isAdmin, canManageSongs, canAddPlans } = useChurch()
  const [songs, setSongs] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [myUpcoming, setMyUpcoming] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!church || fetchedRef.current) return
    fetchedRef.current = true
    Promise.all([
      api.get('/api/songs').then(r => setSongs(r.data.slice(0, 4))),
      api.get('/api/plans', { params: { upcoming: 'true' } }).then(r => setPlans(r.data.slice(0, 4))),
      api.get('/api/plans/my-upcoming').then(r => setMyUpcoming(r.data)),
    ]).finally(() => setLoading(false))
  }, [church])

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
      {isAdmin && (!church?.subscription_status || church?.subscription_status === 'free') && (
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
                  {plan.musician_role && <p className="dash-row-meta">{plan.musician_role}</p>}
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
    </div>
  )
}