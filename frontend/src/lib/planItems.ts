// Display helpers for plan items shared across plan detail and the public share page.

// An empty song placeholder created from a plan template (see claude/plan-templates.md).
export const isSongSlot = (item: { type: string }) => item.type === 'song_slot'

// Label for a non-song row. Slots read "Song to be chosen" (with their optional
// label first); other items fall back to their capitalised type.
export function nonSongLabel(item: { type: string; title?: string | null }): string {
  if (isSongSlot(item)) return item.title ? `${item.title} — song to be chosen` : 'Song to be chosen'
  return item.title || item.type.charAt(0).toUpperCase() + item.type.slice(1)
}
