import { Category, CATEGORIES } from '@/types'

const categoryClasses: Record<Category, string> = {
  praise:     'cat-badge cat-praise',
  assurance:  'cat-badge cat-assurance',
  response:   'cat-badge cat-response',
  other:      'cat-badge cat-other',
}

// Custom (church-added) categories aren't in the static list: title-case their
// value for display, and give them the neutral grey pill so they still look styled.
function titleCase(s: string) {
  return s.replace(/\b\w/g, ch => ch.toUpperCase())
}

export function CategoryBadge({ category }: { category: Category }) {
  const label = CATEGORIES.find(c => c.value === category)?.label ?? titleCase(category)
  return (
    <span className={categoryClasses[category] ?? 'cat-badge cat-other'}>
      {label}
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
