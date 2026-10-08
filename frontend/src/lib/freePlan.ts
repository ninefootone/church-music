// Mirrors backend/utils/limits.js. A church is on the free plan when it has no paid
// subscription (none, 'free' or 'canceled') and hasn't been given lifetime free_access.
// Sample content (is_sample, seeded into new churches) never counts towards the limits.

export const FREE_SONG_LIMIT = 5
export const FREE_PLAN_LIMIT = 1

type ChurchBilling = { free_access?: boolean | null; subscription_status?: string | null } | null | undefined

export function isOnFreePlan(church: ChurchBilling): boolean {
  if (!church || church.free_access) return false
  const status = church.subscription_status
  return !status || status === 'free' || status === 'canceled'
}

export function countOwn<T extends { is_sample?: boolean | null }>(rows: T[]): number {
  return rows.filter(r => !r.is_sample).length
}
