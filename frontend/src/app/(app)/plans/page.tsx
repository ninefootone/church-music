'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Plus, ChevronRight, Copy } from 'lucide-react'
import { useChurch } from '@/context/ChurchContext'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { DuplicatePlanModal } from '@/components/ui/DuplicatePlanModal'

interface Plan {
  id: string
  plan_date: string
  plan_time: string | null
  plan_time_start: string | null
  plan_sort_order: number
  title: string | null
  public_token: string
  status: 'draft' | 'published'
}

export default function PlansPage() {
  const { church, loading: churchLoading, canAddPlans, isAdmin } = useChurch()
  const router = useRouter()
  const [upcoming, setUpcoming] = useState<Plan[]>([])
  const [past, setPast] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const PAST_PAGE_SIZE = 10
  const [visiblePast, setVisiblePast] = useState(PAST_PAGE_SIZE)
  const [duplicatingPlan, setDuplicatingPlan] = useState<Plan | null>(null)

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
    <p className="text-muted dash-loading">Loading…</p>
  )

  const isToday = (dateStr: string) => {
    const today = new Date()
    const d = parseISO(dateStr)
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  }

  const todayPlans = upcoming.filter(s => isToday(s.plan_date))
  const futurePlans = upcoming.filter(s => !isToday(s.plan_date))

  const PlanCard = ({ plan, badge }: { plan: Plan; badge: 'today' | 'upcoming' }) => (
    <div className="plan-card-wrap">
      <Link href={`/plans/${plan.id}`} className="plan-card">
        <div className="dash-row-content">
          <p className="plan-date">
            {format(parseISO(plan.plan_date), 'd MMMM yyyy')}
            {plan.plan_time && (
              <span className="plan-time"> · {plan.plan_time}</span>
            )}
          </p>
          {plan.title && <p className="dash-row-meta">{plan.title}</p>}
        </div>
        <div className="plan-card-right">
          {plan.status === 'draft' && (
            <span className="badge badge-draft">DRAFT</span>
          )}
          <span className={`badge badge-${badge}`}>
            {badge === 'today' ? 'TODAY' : 'UPCOMING'}
          </span>
          <ChevronRight size={18} className="text-muted" />
        </div>
      </Link>
      {(isAdmin || canAddPlans) && (
        <button
          className="plan-card-duplicate"
          title="Duplicate plan"
          onClick={() => setDuplicatingPlan(plan)}
        >
          <Copy size={14} />
        </button>
      )}
    </div>
  )

  const PastRow = ({ plan }: { plan: Plan }) => (
    <div className="plan-row-past-wrap">
      <Link href={`/plans/${plan.id}`} className="plan-row-past">
        <div className="dash-row-content">
          <span className="past-plan-date">
            {format(parseISO(plan.plan_date), 'd MMM yyyy')}
            {plan.plan_time && (
              <span className="plan-time-muted"> · {plan.plan_time}</span>
            )}
            {plan.title && (
              <span className="plan-time-muted"> — {plan.title}</span>
            )}
          </span>
        </div>
        {plan.status === 'draft' && (
          <span className="badge badge-draft">DRAFT</span>
        )}
        <ChevronRight size={15} className="text-muted" />
      </Link>
      {(isAdmin || canAddPlans) && (
        <button
          className="plan-card-duplicate"
          title="Duplicate plan"
          onClick={() => setDuplicatingPlan(plan)}
        >
          <Copy size={14} />
        </button>
      )}
    </div>
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
        <div className="card card-empty">
          <p className="text-muted empty-message">No plans yet.</p>
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
            <div className="card card-notice">
              <p className="text-muted">No upcoming plans. {canAddPlans && <Link href="/plans/new" className="link">Add one</Link>}</p>
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 'var(--space-lg)' }}>Past</div>
              <div className="card card-past-list">
                {past.slice(0, visiblePast).map(s => <PastRow key={s.id} plan={s} />)}
              </div>
              {visiblePast < past.length && (
                <button
                  onClick={() => setVisiblePast(v => v + PAST_PAGE_SIZE)}
                  className="btn btn-secondary btn-load-more"
                >
                  Show more ({past.length - visiblePast} remaining)
                </button>
              )}
            </>
          )}
        </>
      )}
    {duplicatingPlan && (
        <DuplicatePlanModal
          plan={duplicatingPlan}
          onClose={() => setDuplicatingPlan(null)}
          onDuplicated={(newId: string) => router.push(`/plans/${newId}`)}
        />
      )}
    </div>
  )
}
