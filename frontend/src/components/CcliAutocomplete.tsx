'use client'

import { useState, useRef, useEffect } from 'react'
import ccliData from '@/lib/ccli-top200.json'

type CcliEntry = { ccli: string; title: string; author: string }

type Props = {
  titleValue: string
  ccliValue: string
  onTitleChange: (title: string) => void
  onCcliChange: (ccli: string) => void
  onAuthorChange?: (author: string) => void
}

export default function CcliAutocomplete({
  titleValue,
  ccliValue,
  onTitleChange,
  onCcliChange,
  onAuthorChange,
}: Props) {
  const [suggestions, setSuggestions] = useState<CcliEntry[]>([])
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleTitleInput(value: string) {
    onTitleChange(value)
    if (value.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    const lower = value.toLowerCase()
    const matches = (ccliData as CcliEntry[])
      .filter(entry => entry.title.toLowerCase().includes(lower))
      .slice(0, 6)
    setSuggestions(matches)
    setOpen(matches.length > 0)
  }

  function handleSelect(entry: CcliEntry) {
    onTitleChange(entry.title)
    onCcliChange(entry.ccli)
    if (onAuthorChange) onAuthorChange(entry.author)
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
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{entry.title}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                {entry.author} · CCLI {entry.ccli}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}