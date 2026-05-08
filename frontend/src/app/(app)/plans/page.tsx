'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Plus, ChevronRight } from 'lucide-react'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'

interface Plan {
  id: string
  plan_date: string
  plan_time: string | null
  title: string | null
  public_token: string
}

export default function PlansPage() {
  const { church, loading: churchLoading, canAddPlans } = useChurch()
  const [upcoming, setUpcoming] = useState<Plan[]>([])
  const [past, setPast] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!church || churchLoading) return
    Promise.all([
      api.get('/api/plans', { params: { upcoming: 'true' } }),
      api.get('/api/plans', { params: { upcoming: 'false' } }),
    ]).then(([upRes, pastRes]) => {
      setUpcoming(upRes.data)
      setPast(pastRes.data)
    }).catch(err => console.error('Failed to fetch plans:', err))
      .finally(() => setLoading(false))
  }, [church, churchLoading])

  if (loading || churchLoading) return (
    <p className="text-muted" style={{ padding: 'var(--space-xl)' }}>Loading…</p>
  )

  const isToday = (dateStr: string) => {
    const today = new Date()
    const d = parseISO(dateStr)
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  }

  const todayPlans = upcoming.filter(s => isToday(s.plan_date))
  const futurePlans = upcoming.filter(s => !isToday(s.plan_date))

  const PAST_PAGE_SIZE = 10
  const [visiblePast, setVisiblePast] = useState(PAST_PAGE_SIZE)

  const PlanCard = ({ plan, badge }: { plan: Plan; badge: 'today' | 'upcoming' }) => (
    <Link href={`/plans/${plan.id}`} className="plan-card">
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="plan-date">
          {format(parseISO(plan.plan_date), 'd MMMM yyyy')}
          {plan.plan_time && (
            <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}> · {plan.plan_time}</span>
          )}
        </p>
        {plan.title && <p className="dash-row-meta">{plan.title}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span className={`badge badge-${badge}`}>
          {badge === 'today' ? 'TODAY' : 'UPCOMING'}
        </span>
        <ChevronRight size={18} style={{ color: 'var(--color-text-muted)' }} />
      </div>
    </Link>
  )

  const PastRow = ({ plan }: { plan: Plan }) => (
    <Link href={`/plans/${plan.id}`} className="plan-row-past">
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          {format(parseISO(plan.plan_date), 'd MMM yyyy')}
          {plan.plan_time && (
            <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}> · {plan.plan_time}</span>
          )}
          {plan.title && (
            <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}> — {plan.title}</span>
          )}
        </span>
      </div>
      <ChevronRight size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
    </Link>
  )

  const hasAny = upcoming.length > 0 || past.length > 0

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Plans</h1>
        {canAddPlans && (
          <Link href="/plans/new" className="btn btn-primary">
            <Plus size={16} /> Add new plan
          </Link>
        )}
      </div>

      {!hasAny ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
          <p className="text-muted" style={{ marginBottom: 'var(--space-sm)' }}>No plans yet.</p>
          {canAddPlans && <Link href="/plans/new" className="link">Create your first plan</Link>}
        </div>
      ) : (
        <>
          {/* Today */}
          {todayPlans.length > 0 && (
            <>
              <div className="section-label">Today</div>
              {todayPlans.map(s => <PlanCard key={s.id} plan={s} badge="today" />)}
            </>
          )}

          {/* Upcoming */}
          {futurePlans.length > 0 ? (
            <>
              <div className="section-label" style={{ marginTop: todayPlans.length > 0 ? 'var(--space-lg)' : 0 }}>Upcoming</div>
              {futurePlans.map(s => <PlanCard key={s.id} plan={s} badge="upcoming" />)}
            </>
          ) : todayPlans.length === 0 && (
            <div className="card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-md) var(--space-lg)' }}>
              <p className="text-muted">No upcoming plans. {canAddPlans && <Link href="/plans/new" className="link">Add one</Link>}</p>
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 'var(--space-lg)' }}>Past</div>
              <div className="card" style={{ padding: 'var(--space-sm) var(--space-lg)' }}>
                {past.slice(0, visiblePast).map(s => <PastRow key={s.id} plan={s} />)}
              </div>
              {visiblePast < past.length && (
                <button
                  onClick={() => setVisiblePast(v => v + PAST_PAGE_SIZE)}
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: 'var(--space-sm)', justifyContent: 'center', fontSize: 'var(--text-sm)' }}
                >
                  Show more ({past.length - visiblePast} remaining)
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
