'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { useChurch } from '@/context/ChurchContext'

interface Category { id: string; value: string; label: string; scope: 'global' | 'church' }

interface CategorySelectProps {
  value: string
  onChange: (value: string) => void
}

export default function CategorySelect({ value, onChange }: CategorySelectProps) {
  const { church } = useChurch()
  const [cats, setCats] = useState<Category[]>([])

  useEffect(() => {
    if (!church) return
    api.get('/api/songs/categories/all').then(res => setCats(res.data)).catch(() => {})
  }, [church])

  const globalCats = cats.filter(c => c.scope === 'global')
  const churchCats = cats.filter(c => c.scope === 'church')

  // If the song's current value isn't in the fetched list (e.g. a legacy value),
  // still render it as an option so it displays and isn't silently lost on save.
  const hasCurrent = !value || cats.some(c => c.value === value)

  return (
    <select className="input" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Select category…</option>
      {!hasCurrent && <option value={value}>{value}</option>}
      {churchCats.length > 0 ? (
        <>
          <optgroup label="Suggested">
            {globalCats.map(c => <option key={c.id} value={c.value}>{c.label}</option>)}
          </optgroup>
          <optgroup label="Your church's">
            {churchCats.map(c => <option key={c.id} value={c.value}>{c.label}</option>)}
          </optgroup>
        </>
      ) : (
        globalCats.map(c => <option key={c.id} value={c.value}>{c.label}</option>)
      )}
    </select>
  )
}
