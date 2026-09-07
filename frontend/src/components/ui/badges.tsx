import { Category } from '@/types'

// Colour styling per known category value. Presentation only — the list of which
// categories exist lives in the database, not here. Unknown values get the neutral pill.
const categoryClasses: Record<string, string> = {
  praise:     'cat-badge cat-praise',
  assurance:  'cat-badge cat-assurance',
  response:   'cat-badge cat-response',
  other:      'cat-badge cat-other',
}

// Display label is the title-cased value (e.g. 'youth praise' → 'Youth Praise').
function titleCase(s: string) {
  return s.replace(/\b\w/g, ch => ch.toUpperCase())
}

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <span className={categoryClasses[category] ?? 'cat-badge cat-other'}>
      {titleCase(category)}
    </span>
  )
}

export function KeyBadge({ keyOf }: { keyOf: string }) {
  const normalised = keyOf.replace(/♯/g, '#').replace(/♭/g, 'b')
  return <span className="badge-key">{normalised}</span>
}

export function RetiredBadge() {
  return <span className="badge-retired">Retired</span>
}

export function DraftBadge() {
  return <span className="badge-draft">Draft</span>
}

// Why a song surfaced in a search result: tag / lyric / other-field match.
// Title matches are self-evident, so they get no badge.
const matchLabels: Record<string, string> = { tag: 'Tag', lyric: 'Lyric', other: 'Text' }

export function MatchBadge({ reason }: { reason: string }) {
  const label = matchLabels[reason]
  if (!label) return null
  return <span className={`badge-match badge-match--${reason}`}>{label}</span>
}
