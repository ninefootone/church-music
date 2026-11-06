'use client'

import { formatClock } from '@/lib/planTimes'

// The time pill(s) above a plan's running order (plan page + public share page).
// A plan with extra_times (project doc multi-service-plans.md) shows one pill per service.
// When `interactive` (Show timings on + items have durations) they become buttons that pick
// which service the running-order times are worked out from. Otherwise they're just labels.
export default function ServiceTimePills({ times, selected, onSelect, interactive }: {
  times: string[]
  selected: string
  onSelect: (time: string) => void
  interactive: boolean
}) {
  const clickable = interactive && times.length > 1
  return (
    <div className="plan-divider">
      <div className="plan-divider-line" />
      <div className="plan-divider-pills">
        {times.map(t => clickable ? (
          <button
            key={t}
            type="button"
            className={`plan-divider-label plan-divider-pill${t === selected ? ' is-selected' : ''}`}
            aria-pressed={t === selected}
            title={`Show timings for the ${formatClock(t)} service`}
            onClick={() => onSelect(t)}
          >
            {formatClock(t)}
          </button>
        ) : (
          <span key={t} className="plan-divider-label">{formatClock(t)}</span>
        ))}
      </div>
      <div className="plan-divider-line" />
    </div>
  )
}
