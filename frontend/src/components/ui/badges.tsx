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
// Full literal class names (never built with template strings) so Tailwind's
// content scanner keeps these @layer rules instead of tree-shaking them out —
// same reason CategoryBadge above uses a lookup map of complete class strings.
const matchBadges: Record<string, { label: string; className: string }> = {
  tag:   { label: 'Tag',   className: 'badge-match badge-match--tag' },
  lyric: { label: 'Lyric', className: 'badge-match badge-match--lyric' },
  other: { label: 'Text',  className: 'badge-match badge-match--other' },
}

export function MatchBadge({ reason }: { reason: string }) {
  const b = matchBadges[reason]
  if (!b) return null
  return <span className={b.className}>{b.label}</span>
}
