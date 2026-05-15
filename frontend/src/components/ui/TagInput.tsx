'use client'

import { useState, useEffect } from 'react'
import api, { setAuthToken } from '@/lib/api'
import { useAuth } from '@clerk/nextjs'
import { X } from 'lucide-react'

interface Tag { id: string; name: string }

interface TagInputProps {
  value: string[]        // array of selected tag IDs
  onChange: (ids: string[]) => void
}

export default function TagInput({ value, onChange }: TagInputProps) {
  const { getToken } = useAuth()
  const [allTags, setAllTags] = useState<Tag[]>([])

  useEffect(() => {
    getToken().then(token => {
      setAuthToken(token)
      return api.get('/api/songs/tags/all')
    }).then(res => setAllTags(res.data)).catch(() => {})
  }, [getToken])

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  if (allTags.length === 0) {
    return <p className="settings-hint">No approved tags yet.</p>
  }

  return (
    <div className="tag-picker">
      {allTags.map(tag => {
        const selected = value.includes(tag.id)
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            className={`tag-chip ${selected ? 'tag-chip--selected' : ''}`}
          >
            {tag.name}
            {selected && <X size={11} className="tag-chip-x" />}
          </button>
        )
      })}
    </div>
  )
}