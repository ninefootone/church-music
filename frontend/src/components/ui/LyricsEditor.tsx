'use client'

import { useRef } from 'react'
import { Bold, Italic } from 'lucide-react'

interface LyricsEditorProps {
  value: string
  onChange: (value: string) => void
  rows?: number
}

export function LyricsEditor({ value, onChange, rows = 12 }: LyricsEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const wrapSelection = (before: string, after: string) => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end)
    const newValue = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(newValue)
    // Restore selection after state update
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + before.length, end + before.length)
    }, 0)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <button
          type="button"
          onClick={() => wrapSelection('**', '**')}
          title="Bold"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', cursor: 'pointer', color: 'var(--color-text-secondary)', transition: 'all var(--transition-fast)' }}
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          onClick={() => wrapSelection('_', '_')}
          title="Italic"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', cursor: 'pointer', color: 'var(--color-text-secondary)', transition: 'all var(--transition-fast)' }}
        >
          <Italic size={15} />
        </button>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', alignSelf: 'center', marginLeft: 4 }}>
          Select text then click to format
        </span>
      </div>
      <textarea
        ref={ref}
        className="input"
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Paste lyrics here…"
        style={{ resize: 'vertical', fontFamily: 'inherit' }}
      />
    </div>
  )
}
