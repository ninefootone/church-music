'use client'

import { useState, useEffect } from 'react'
import { X, ChevronUp, ChevronDown } from 'lucide-react'

const KEYS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

interface ChordProViewerProps {
  content: string
  originalKey?: string | null
  songKey?: string | null
  label: string
  onClose: () => void
}

export function ChordProViewer({ content, originalKey, songKey, label, onClose }: ChordProViewerProps) {
  const [selectedKey, setSelectedKey] = useState<string>(songKey || originalKey || '')
  const [rendered, setRendered] = useState<string>('')
  const [fontSize, setFontSize] = useState(15)

  useEffect(() => {
    async function render() {
      try {
        const { default: ChordSheetJS } = await import('chordsheetjs')
        const parser = new ChordSheetJS.ChordProParser()
        const song = parser.parse(content)

        const formatter = new ChordSheetJS.HtmlDivFormatter()
        if (!document.getElementById('chordsheetjs-css')) {
          const style = document.createElement('style')
          style.id = 'chordsheetjs-css'
          style.textContent = ChordSheetJS.HtmlDivFormatter.cssString('.chordpro-render')
          document.head.appendChild(style)
        }
        if (selectedKey && (originalKey || songKey)) {
          const fromKey = originalKey || songKey || 'C'
          if (selectedKey !== fromKey) {
            const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            const normalize = (k: string) => k.replace('Db','C#').replace('Eb','D#').replace('Gb','F#').replace('Ab','G#').replace('Bb','A#')
            const fromIdx = CHROMATIC.indexOf(normalize(fromKey))
            const toIdx = CHROMATIC.indexOf(normalize(selectedKey))
            if (fromIdx !== -1 && toIdx !== -1) {
              let semitones = toIdx - fromIdx
              if (semitones < 0) semitones += 12
              const transposed = song.transpose(semitones)
              setRendered(formatter.format(transposed))
              return
            }
          }
        }

        setRendered(formatter.format(song))
      } catch (err) {
        console.error('ChordPro render error:', err)
        // Fallback: show raw content
        setRendered(`<pre style="font-family: monospace; white-space: pre-wrap;">${content}</pre>`)
      }
    }
    render()
  }, [content, selectedKey, originalKey, songKey])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
      {/* Toolbar */}
      <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '10px var(--space-lg)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>

        {/* Key selector */}
        {(originalKey || songKey) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Key</span>
            <select
              className="input"
              style={{ fontSize: 'var(--text-sm)', padding: '4px 8px', width: 'auto' }}
              value={selectedKey}
              onChange={e => setSelectedKey(e.target.value)}
            >
              {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        )}

        {/* Font size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => setFontSize(s => Math.max(10, s - 1))}
            style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '2px 6px', color: 'var(--color-text-secondary)', display: 'flex' }}
          >
            <ChevronDown size={14} />
          </button>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', minWidth: 28, textAlign: 'center' }}>{fontSize}px</span>
          <button
            onClick={() => setFontSize(s => Math.min(28, s + 1))}
            style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '2px 6px', color: 'var(--color-text-secondary)', display: 'flex' }}
          >
            <ChevronUp size={14} />
          </button>
        </div>

        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'flex', flexShrink: 0 }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-lg)' }}>
        <div
          className="chordpro-render"
          style={{ fontSize: fontSize, maxWidth: 800, margin: '0 auto' }}
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      </div>
    </div>
  )
}
