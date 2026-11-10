// Display helpers for plan items shared across plan detail and the public share page.

// An empty song placeholder created from a plan template (see claude/plan-templates.md).
export const isSongSlot = (item: { type: string }) => item.type === 'song_slot'

// Label for a non-song row. Slots read "Song to be chosen" (with their optional
// label first); other items fall back to their capitalised type.
export function nonSongLabel(item: { type: string; title?: string | null }): string {
  if (isSongSlot(item)) return item.title ? `${item.title} — song to be chosen` : 'Song to be chosen'
  return item.title || item.type.charAt(0).toUpperCase() + item.type.slice(1)
}

// A song with no minutes saved on the plan uses the song's default length — the same
// rule as the plan editor and Plans overview, so timings match everywhere.
export function withSongDefaultDurations<T extends { items?: any[] }>(plan: T): T {
  if (!Array.isArray(plan?.items)) return plan
  return {
    ...plan,
    items: plan.items.map(item => ({
      ...item,
      duration_minutes: item.duration_minutes ?? item.song_default_duration ?? null,
    })),
  }
}

// Service item chips shown when a church has no Service items library of its own
// (plan builder + Plans overview). Added as 'custom' items with just this title.
export const DEFAULT_SERVICE_ITEMS: { title: string; content?: string | null; note?: string | null }[] = [
  { title: 'Welcome' },
  { title: 'Prayer' },
  { title: 'Confession' },
  { title: 'Assurance' },
  { title: 'Reading' },
  { title: 'Sermon' },
  { title: 'Communion' },
  { title: 'Announcement' },
]
