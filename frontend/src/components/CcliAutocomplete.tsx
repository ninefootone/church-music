'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import api, { setAuthToken } from '@/lib/api'

type CcliEntry = {
  ccli_number: string
  title: string
  author: string
  first_line: string
  default_key: string
  category: string
  in_library: boolean
}

type Props = {
  titleValue: string
  ccliValue: string
  onTitleChange: (title: string) => void
  onCcliChange: (ccli: string) => void
  onAuthorChange?: (author: string) => void
  onFirstLineChange?: (firstLine: string) => void
  onDefaultKeyChange?: (key: string) => void
  onCategoryChange?: (category: string) => void
}

export default function CcliAutocomplete({
  titleValue,
  ccliValue,
  onTitleChange,
  onCcliChange,
  onAuthorChange,
  onFirstLineChange,
  onDefaultKeyChange,
  onCategoryChange,
}: Props) {
  const [suggestions, setSuggestions] = useState<CcliEntry[]>([])
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { getToken } = useAuth()

  function handleTitleInput(value: string) {
    onTitleChange(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const token = await getToken()
        setAuthToken(token)
        const { data } = await api.get(`/api/ccli?q=${encodeURIComponent(value)}`)
        setSuggestions(data)
        setOpen(data.length > 0)
      } catch {
        setSuggestions([])
        setOpen(false)
      }
    }, 300)
  }

  function handleSelect(entry: CcliEntry) {
    onTitleChange(entry.title)
    onCcliChange(entry.ccli_number)
    if (onAuthorChange && entry.author) onAuthorChange(entry.author)
    if (onFirstLineChange && entry.first_line) onFirstLineChange(entry.first_line)
    if (onDefaultKeyChange && entry.default_key) onDefaultKeyChange(entry.default_key)
    if (onCategoryChange && entry.category) onCategoryChange(entry.category)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        className="input"
        placeholder="Song title"
        value={titleValue}
        onChange={e => handleTitleInput(e.target.value)}
        autoComplete="off"
      />
      {open && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '0.5rem',
          marginTop: '0.25rem',
          padding: '0.25rem 0',
          listStyle: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          maxHeight: '260px',
          overflowY: 'auto',
        }}>
          {suggestions.map((entry, i) => (
            <li
              key={i}
              onMouseDown={() => handleSelect(entry)}
              style={{
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-hover, rgba(0,0,0,0.05))')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{entry.title}</span>
                {entry.in_library && (
                  <span style={{
                    fontSize: '0.65rem',
                    background: 'var(--color-brand-100, #e0f2fe)',
                    color: 'var(--color-brand-700, #0369a1)',
                    borderRadius: '999px',
                    padding: '0.1rem 0.45rem',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                  }}>In library</span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                {entry.author} · CCLI {entry.ccli_number}
                {entry.default_key && ` · Key of ${entry.default_key}`}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}