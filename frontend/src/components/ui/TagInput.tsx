'use client'

import { useState, useEffect, useRef } from 'react'
import api, { setAuthToken } from '@/lib/api'
import { useAuth } from '@clerk/nextjs'

interface TagInputProps {
  value: string
  onChange: (value: string) => void
}

export default function TagInput({ value, onChange }: TagInputProps) {
  const { getToken } = useAuth()
  const [allTags, setAllTags] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getToken().then(token => {
      setAuthToken(token)
      return api.get('/api/songs/tags/all')
    }).then(res => setAllTags(res.data)).catch(() => {})
  }, [getToken])

  // Get the tag currently being typed (last segment after the final comma)
  const getCurrentToken = (val: string) => {
    const parts = val.split(',')
    return parts[parts.length - 1].trimStart()
  }

  const getExistingTags = (val: string) => {
    const parts = val.split(',')
    return parts.slice(0, -1).map(t => t.trim().toLowerCase())
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)

    const token = getCurrentToken(val)
    const existing = getExistingTags(val)

    if (token.length >= 1) {
      const filtered = allTags.filter(tag =>
        tag.toLowerCase().startsWith(token.toLowerCase()) &&
        !existing.includes(tag.toLowerCase())
      )
      setSuggestions(filtered.slice(0, 8))
      setShowDropdown(filtered.length > 0)
    } else {
      setSuggestions([])
      setShowDropdown(false)
    }
    setActiveIndex(-1)
  }

  const applySuggestion = (tag: string) => {
    const parts = value.split(',')
    parts[parts.length - 1] = ' ' + tag
    // Clean up: no leading comma/space on first tag
    const newValue = parts
      .map((p, i) => i === 0 ? p.trimStart() : p)
      .join(',') + ', '
    onChange(newValue)
    setSuggestions([])
    setShowDropdown(false)
    setActiveIndex(-1)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (activeIndex >= 0) {
        e.preventDefault()
        applySuggestion(suggestions[activeIndex])
      } else {
        setShowDropdown(false)
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        className="input"
        placeholder="God's Faithfulness, Grace, The Cross"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          const token = getCurrentToken(value)
          if (token.length >= 1 && suggestions.length > 0) setShowDropdown(true)
        }}
        autoComplete="off"
      />
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            marginTop: '4px',
            zIndex: 50,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            overflow: 'hidden',
          }}
        >
          {suggestions.map((tag, i) => (
            <div
              key={tag}
              onMouseDown={() => applySuggestion(tag)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                background: i === activeIndex ? 'var(--color-brand-100)' : 'transparent',
                color: 'var(--color-text-primary)',
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}