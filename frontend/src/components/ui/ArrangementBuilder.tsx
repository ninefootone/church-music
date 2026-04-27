'use client'

import { useState, useRef } from 'react'
import { GripVertical, X, Plus } from 'lucide-react'

const PRESET_ELEMENTS = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Tag', 'Instrumental', 'Ending']

type Item = { id: string; label: string }

function parseArrangement(value: string): { items: Item[]; isLegacy: boolean } {
  if (!value) return { items: [], isLegacy: false }
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return {
        items: parsed.map((label: string, i: number) => ({ id: `${i}-${label}`, label })),
        isLegacy: false,
      }
    }
  } catch {}
  return { items: [], isLegacy: true }
}

function buildCountedLabel(base: string, existing: Item[]): string {
  const matches = existing.filter(
    i => i.label === base || i.label.match(new RegExp(`^${base} \\d+$`))
  )
  if (matches.length === 0) return base
  return `${base} ${matches.length + 1}`
}

function nextLabel(base: string, existing: Item[]): string {
  if (base === 'Verse') return buildCountedLabel(base, existing)
  return base
}

let idCounter = 0
function uid() { return `item-${++idCounter}` }

interface Props {
  value: string
  onChange: (value: string) => void
}

export function ArrangementBuilder({ value, onChange }: Props) {
  const { items: initialItems, isLegacy } = parseArrangement(value)
  const [items, setItems] = useState<Item[]>(initialItems)
  const [showLegacyPrompt, setShowLegacyPrompt] = useState(isLegacy)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Drag (mouse) refs
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)

  // Touch refs
  const touchItem = useRef<number | null>(null)
  const touchListRef = useRef<HTMLDivElement | null>(null)

  const emit = (next: Item[]) => {
    onChange(JSON.stringify(next.map(i => i.label)))
  }

  const addElement = (base: string) => {
    const label = nextLabel(base, items)
    let updated = [...items]
    if (base === 'Verse' && items.some(i => i.label === 'Verse')) {
      updated = updated.map(i => i.label === 'Verse' ? { ...i, label: 'Verse 1' } : i)
    }
    const newItems = [...updated, { id: uid(), label }]
    setItems(newItems)
    emit(newItems)
  }

  const removeItem = (id: string) => {
    const next = items.filter(i => i.id !== id)
    setItems(next)
    emit(next)
  }

  const updateLabel = (id: string, label: string) => {
    const next = items.map(i => i.id === id ? { ...i, label } : i)
    setItems(next)
    emit(next)
  }

  // ── Mouse drag handlers ───────────────────────────────────────
  const handleDragStart = (index: number) => {
    dragItem.current = index
  }

  const handleDragEnter = (index: number) => {
    if (dragItem.current === null || dragItem.current === index) return
    const next = [...items]
    const [moved] = next.splice(dragItem.current, 1)
    next.splice(index, 0, moved)
    dragItem.current = index
    setItems(next)
    emit(next)
  }

  const handleDragEnd = () => {
    dragItem.current = null
    dragOver.current = null
  }

  // ── Touch drag handlers ───────────────────────────────────────
  const handleTouchStart = (index: number) => {
    touchItem.current = index
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchItem.current === null) return
    e.preventDefault()
    const touch = e.touches[0]
    const list = touchListRef.current
    if (!list) return
    const children = Array.from(list.children) as HTMLElement[]
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect()
      if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
          touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        if (i !== touchItem.current) {
          const next = [...items]
          const [moved] = next.splice(touchItem.current, 1)
          next.splice(i, 0, moved)
          touchItem.current = i
          setItems(next)
          emit(next)
        }
        break
      }
    }
  }

  const handleTouchEnd = () => {
    touchItem.current = null
  }

  // ── Legacy prompt ─────────────────────────────────────────────
  const convertLegacy = () => {
    const parts = value.split(',').map(s => s.trim()).filter(Boolean)
    const converted = parts.map(label => ({ id: uid(), label }))
    setItems(converted)
    setShowLegacyPrompt(false)
    emit(converted)
  }

  const discardLegacy = () => {
    setShowLegacyPrompt(false)
    setItems([])
    onChange('')
  }

  if (showLegacyPrompt) {
    return (
      <div className="arrangement-legacy-notice">
        <p className="arrangement-legacy-text">
          This song has an existing text arrangement: <em>{value}</em>
        </p>
        <div className="arrangement-legacy-actions">
          <button type="button" className="btn btn-sm btn-primary" onClick={convertLegacy}>
            Convert to builder
          </button>
          <button type="button" className="btn btn-sm btn-secondary" onClick={discardLegacy}>
            Start fresh
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="arrangement-builder">
      <div className="arrangement-presets">
        {PRESET_ELEMENTS.map(el => (
          <button
            key={el}
            type="button"
            className="btn btn-ghost btn-sm arrangement-preset-btn"
            onClick={() => addElement(el)}
          >
            <Plus size={12} /> {el}
          </button>
        ))}
      </div>

      {items.length > 0 && (
        <div
          className="arrangement-list"
          ref={touchListRef}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {items.map((item, index) => (
            <div
              key={item.id}
              className="arrangement-item"
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              onTouchStart={() => handleTouchStart(index)}
            >
              <span className="arrangement-grip"><GripVertical size={14} /></span>
              {editingId === item.id ? (
                <input
                  className="arrangement-item-input"
                  value={item.label}
                  autoFocus
                  onChange={e => updateLabel(item.id, e.target.value)}
                  onBlur={() => setEditingId(null)}
                  onKeyDown={e => { if (e.key === 'Enter') setEditingId(null) }}
                />
              ) : (
                <span
                  className="arrangement-item-label"
                  onClick={() => setEditingId(item.id)}
                  title="Click to rename"
                >
                  {item.label}
                </span>
              )}
              <button
                type="button"
                className="arrangement-remove"
                onClick={() => removeItem(item.id)}
                title="Remove"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <p className="arrangement-empty">Add elements above to build the arrangement.</p>
      )}

      {items.length > 0 && (
        <p className="arrangement-hint">Click an item to rename it. Drag to reorder — best done on desktop.</p>
      )}
    </div>
  )
}