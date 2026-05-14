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
  onBlur?: () => void
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
  onBlur,
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
    <div ref={wrapperRef} className="ccli-wrap">
      <input
        className="input"
        placeholder="Song title"
        value={titleValue}
        onChange={e => handleTitleInput(e.target.value)}
        onBlur={() => { setOpen(false); onBlur?.() }}
        autoComplete="off"
      />
      {open && (
        <ul className="ccli-dropdown">
          {suggestions.map((entry, i) => (
            <li
              key={i}
              onMouseDown={() => handleSelect(entry)}
              className="ccli-option"
              style={{ borderBottom: i < suggestions.length - 1 ? '1px solid var(--color-border)' : 'none' }}
            >
              <div className="ccli-option-title-row">
                <span className="ccli-option-title">{entry.title}</span>
                {entry.in_library && (
                  <span className="ccli-in-library">In library</span>
                )}
              </div>
              <div className="ccli-option-meta">
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