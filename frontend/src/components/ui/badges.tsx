import { Category, CATEGORIES } from '@/types'

const categoryClasses: Record<Category, string> = {
  praise:     'cat-badge cat-praise',
  assurance:  'cat-badge cat-assurance',
  response:   'cat-badge cat-response',
  other:      'cat-badge cat-other',
}

export function CategoryBadge({ category }: { category: Category }) {
  const label = CATEGORIES.find(c => c.value === category)?.label ?? category
  return (
    <span className={categoryClasses[category] ?? 'cat-badge'}>
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
