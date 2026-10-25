// Multi-service plans (project doc multi-service-plans.md). A plan's plan_start_time is the first
// service; extra_times are further start times for an identical repeat of the same plan.

// '09:15' or '09:15:00' → '9:15 am' (same format plan_time uses).
export function formatClock(hhmm: string | null | undefined): string {
  if (!hhmm) return ''
  return new Date(`1970-01-01T${hhmm.slice(0, 5)}`).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export const MAX_EXTRA_TIMES = 3

// Checks the "Also at" times before saving. Returns an error message, or '' when fine.
// Blank inputs are ignored (the backend drops them too).
export function extraTimesError(startTime: string, extraTimes: string[]): string {
  const times = extraTimes.filter(Boolean).map(t => t.slice(0, 5))
  if (times.length === 0) return ''
  if (!startTime) return 'Set a start time before adding more service times'
  const start = startTime.slice(0, 5)
  if (times.some(t => t <= start)) return 'Extra service times must be later than the start time'
  if (new Set(times).size !== times.length) return 'Each service time can only be added once'
  if (times.length > MAX_EXTRA_TIMES) return `You can add up to ${MAX_EXTRA_TIMES} extra service times`
  return ''
}

// Trims to 'HH:MM' and drops blanks, ready to send as extra_times.
export function cleanExtraTimes(extraTimes: string[]): string[] {
  return extraTimes.filter(Boolean).map(t => t.slice(0, 5))
}
