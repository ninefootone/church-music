'use client'

import { useState, useEffect } from 'react'
import api, { setAuthToken } from '@/lib/api'
import { useAuth } from '@clerk/nextjs'
import { useChurch } from '@/context/ChurchContext'
import { X } from 'lucide-react'

interface Tag { id: string; name: string; scope: 'global' | 'church' }

interface TagInputProps {
  value: string[]        // array of selected tag IDs
  onChange: (ids: string[]) => void
}

export default function TagInput({ value, onChange }: TagInputProps) {
  const { getToken } = useAuth()
  const { canManageSongs } = useChurch()
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [newTag, setNewTag] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  async function addTag() {
    const name = newTag.trim()
    if (!name || adding) return
    setAdding(true)
    setError(null)
    try {
      const token = await getToken()
      setAuthToken(token)
      // Returns { id, name, scope }. The backend normalises + dedups, so this may
      // hand back an existing global or church tag rather than a new one.
      const { data } = await api.post('/api/songs/tags/church', { name })
      setAllTags(prev => prev.some(t => t.id === data.id) ? prev : [...prev, data])
      if (!value.includes(data.id)) onChange([...value, data.id])
      setNewTag('')
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not add tag')
    } finally {
      setAdding(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()   // don't submit the surrounding song form
      addTag()
    }
  }

  function chip(tag: Tag) {
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
  }

  const globalTags = allTags.filter(t => t.scope === 'global')
  const churchTags = allTags.filter(t => t.scope === 'church')

  return (
    <div className="tag-input">
      {globalTags.length > 0 && (
        <div className="tag-group">
          <p className="tag-group-label">Suggested tags</p>
          <div className="tag-picker">{globalTags.map(chip)}</div>
        </div>
      )}

      {churchTags.length > 0 && (
        <div className="tag-group">
          <p className="tag-group-label">Your church&apos;s tags</p>
          <div className="tag-picker">{churchTags.map(chip)}</div>
        </div>
      )}

      {allTags.length === 0 && (
        <p className="settings-hint">No tags yet.</p>
      )}

      {canManageSongs && (
        <div className="tag-add-row">
          <input
            type="text"
            className="tag-add-input"
            placeholder="Add your own tag…"
            value={newTag}
            maxLength={40}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            className="tag-add-btn"
            onClick={addTag}
            disabled={adding || !newTag.trim()}
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}

      {error && <p className="settings-hint settings-hint--error">{error}</p>}
    </div>
  )
}
