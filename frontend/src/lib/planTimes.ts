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

// The time line shown for a plan: "9:15 am", or "9:15 am & 11:00 am" when it repeats.
// Uses plan_start_time when set, otherwise the free-text plan_time. '' when there is no time.
export function planTimeLabel(plan: { plan_time?: string | null; plan_start_time?: string | null; extra_times?: string[] | null }): string {
  const first = plan.plan_start_time ? formatClock(plan.plan_start_time) : (plan.plan_time ?? '')
  if (!first) return ''
  const extras = (plan.extra_times ?? []).map(formatClock)
  return [first, ...extras].join(' & ')
}

// ── Per-service items (2026-11-18, project doc per-service-items.md) ─────────────────────────
// On a plan with extra_times, an item's service_times say which services it's at (e.g. a baptism
// at 9:15 only). [] = every service. Same rules as backend utils/extraTimes.js.

type TimedPlan = { plan_start_time?: string | null; extra_times?: string[] | null }
type TimedItem = { service_times?: string[] | null }

// The plan's services as 'HH:MM': [start, ...extra]. [] without a start time.
export function planServiceTimes(plan: TimedPlan | null | undefined): string[] {
  if (!plan?.plan_start_time) return []
  return [plan.plan_start_time, ...(plan.extra_times ?? [])].map(t => t.slice(0, 5))
}

// The plan times this item is at, or [] when it's at every service (also when its stored times
// match none of the plan's — treated as every service, never as none).
export function itemServiceTimes(item: TimedItem, planTimes: string[]): string[] {
  const mine = (item.service_times ?? []).map(t => t.slice(0, 5)).filter(t => planTimes.includes(t))
  return mine.length === 0 || mine.length >= planTimes.length ? [] : mine
}

export function isAtService(item: TimedItem, planTimes: string[], time: string | null | undefined): boolean {
  const mine = itemServiceTimes(item, planTimes)
  return mine.length === 0 || !time || mine.includes(time.slice(0, 5))
}

// "9:15 am only" / "9:15 am & 11:00 am only", or null for an every-service item.
export function serviceOnlyLabel(item: TimedItem, planTimes: string[]): string | null {
  const mine = itemServiceTimes(item, planTimes)
  return mine.length ? `${mine.map(formatClock).join(' & ')} only` : null
}
