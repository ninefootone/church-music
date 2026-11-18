'use client'

import { useState } from 'react'
import { GripVertical, X, Plus } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { parseArrangement } from '@/lib/arrangement'

const PRESET_ELEMENTS = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Tag', 'Link', 'Turnaround', 'Instrumental', 'Ending']

type Item = { id: string; label: string }

function toItems(value: string): { items: Item[]; isLegacy: boolean } {
  if (!value) return { items: [], isLegacy: false }
  const parts = parseArrangement(value)
  if (parts) return { items: parts.map((label, i) => ({ id: `${i}-${label}`, label })), isLegacy: false }
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

// One draggable pill. The whole pill drags (pills are small), but only after the pointer moves 5px
// (or a 150ms press on touch), so a plain click still renames and the × still removes.
// Translate, not Transform: pills are different widths and Transform would stretch them.
function SortablePill({
  item, editing, onStartEdit, onStopEdit, onRename, onRemove,
}: {
  item: Item
  editing: boolean
  onStartEdit: () => void
  onStopEdit: () => void
  onRename: (label: string) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: editing })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`arrangement-item${isDragging ? ' arrangement-item--dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <span className="arrangement-grip"><GripVertical size={14} /></span>
      {editing ? (
        <input
          className="arrangement-item-input"
          value={item.label}
          autoFocus
          onChange={e => onRename(e.target.value)}
          onBlur={onStopEdit}
          onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') onStopEdit() }}
        />
      ) : (
        <span className="arrangement-item-label" onClick={onStartEdit} title="Click to rename">
          {item.label}
        </span>
      )}
      <button type="button" className="arrangement-remove" onClick={onRemove} title="Remove">
        <X size={12} />
      </button>
    </div>
  )
}

interface Props {
  value: string
  onChange: (value: string) => void
}

export function ArrangementBuilder({ value, onChange }: Props) {
  const { items: initialItems, isLegacy } = toItems(value)
  const [items, setItems] = useState<Item[]>(initialItems)
  const [showLegacyPrompt, setShowLegacyPrompt] = useState(isLegacy)
  const [editingId, setEditingId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = items.findIndex(i => i.id === active.id)
    const to = items.findIndex(i => i.id === over.id)
    if (from < 0 || to < 0) return
    const next = arrayMove(items, from, to)
    setItems(next)
    emit(next)
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
      <p className="arrangement-hint">Tap to add — these build the arrangement below.</p>
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy}>
            <div className="arrangement-list">
              {items.map(item => (
                <SortablePill
                  key={item.id}
                  item={item}
                  editing={editingId === item.id}
                  onStartEdit={() => setEditingId(item.id)}
                  onStopEdit={() => setEditingId(null)}
                  onRename={label => updateLabel(item.id, label)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {items.length === 0 && (
        <p className="arrangement-empty">Add elements above to build the arrangement.</p>
      )}

      {items.length > 0 && (
        <p className="arrangement-hint">Click an item to rename it. Drag to reorder (on a phone, press and hold first).</p>
      )}
    </div>
  )
}