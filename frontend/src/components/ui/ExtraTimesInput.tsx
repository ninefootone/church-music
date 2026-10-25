'use client'

// "Also at" service times for a plan or template (project doc multi-service-plans.md).
// One plan that runs again, identically, at later times — e.g. 9:15 also at 11:00.

import { Plus, X } from 'lucide-react'
import { MAX_EXTRA_TIMES } from '@/lib/planTimes'

interface Props {
  startTime: string            // 'HH:MM' or '' — extra times need a start time first
  value: string[]              // 'HH:MM' strings; '' while a new row is being filled in
  onChange: (times: string[]) => void
}

export default function ExtraTimesInput({ startTime, value, onChange }: Props) {
  const update = (i: number, t: string) => onChange(value.map((v, j) => (j === i ? t : v)))
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i))
  const add = () => onChange([...value, ''])

  return (
    <div className="extra-times">
      {value.map((t, i) => (
        <div key={i} className="extra-times-row">
          <span className="extra-times-label">Also at</span>
          <input
            className="input extra-times-input"
            type="time"
            value={t}
            onChange={e => update(i, e.target.value)}
            aria-label={`Extra service time ${i + 1}`}
          />
          <button type="button" className="btn-icon-remove" onClick={() => remove(i)} aria-label="Remove this service time">
            <X size={16} />
          </button>
        </div>
      ))}

      {value.length < MAX_EXTRA_TIMES && (
        <button
          type="button"
          className="btn btn-secondary btn-sm extra-times-add"
          onClick={add}
          disabled={!startTime}
          title={!startTime ? 'Set a start time first' : ''}
        >
          <Plus size={14} /> Same service again later
        </button>
      )}

      {value.length > 0 && (
        <p className="extra-times-note">
          This plan happens again at these times, exactly the same: same songs, order, musicians and notes.
          Each song counts once per service in your CCLI report, so don&apos;t make a separate plan for these
          times as well. If a service needs to be different, make a separate plan for it instead.
        </p>
      )}
    </div>
  )
}
