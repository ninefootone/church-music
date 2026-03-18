import { Category, CATEGORIES } from '@/types'

const categoryClasses: Record<Category, string> = {
  praise:     'cat-badge cat-praise',
  confession: 'cat-badge cat-confession',
  assurance:  'cat-badge cat-assurance',
  communion:  'cat-badge cat-communion',
  lament:     'cat-badge cat-lament',
  response:   'cat-badge cat-response',
  sending:    'cat-badge cat-sending',
}

export function CategoryBadge({ category }: { category: Category }) {
  const label = CATEGORIES.find(c => c.value === category)?.label ?? category
  return (
    <span className={categoryClasses[category]}>
      {label}
    </span>
  )
}

export function KeyBadge({ keyOf }: { keyOf: string }) {
  return <span className="badge-key">{keyOf}</span>
}
