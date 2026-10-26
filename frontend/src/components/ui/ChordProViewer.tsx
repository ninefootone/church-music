'use client'

import { useState, useEffect } from 'react'
import { X, ChevronUp, ChevronDown } from 'lucide-react'
import { renderChordPro, semitonesBetween } from '@/lib/chordproRender'
import { KEYS } from '@/lib/keys'


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
    let cancelled = false
    const fromKey = originalKey || songKey
    const semitones = selectedKey && fromKey ? semitonesBetween(fromKey, selectedKey) : 0
    renderChordPro(content, semitones).then(result => {
      if (cancelled) return
      if (result.ok) { setRendered(result.html); return }
      console.error('ChordPro render error:', result.message)
      // Fallback: show raw content, escaped — never trust unparsed ChordPro as HTML
      const escaped = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      setRendered(`<pre style="font-family: monospace; white-space: pre-wrap;">${escaped}</pre>`)
    })
    return () => { cancelled = true }
  }, [content, selectedKey, originalKey, songKey])

  return (
    <div className="chordpro-viewer">
      {/* Toolbar */}
      <div className="chordpro-toolbar">
        <span className="chordpro-title">
          {label}
        </span>

        {/* Key selector */}
        {(originalKey || songKey) && (
          <div className="chordpro-key-group">
            <span className="chordpro-key-label">Key</span>
            <select
              className="input transpose-select"
              value={selectedKey}
              onChange={e => setSelectedKey(e.target.value)}
            >
              {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        )}

        {/* Font size */}
        <div className="chordpro-font-controls">
          <button
            onClick={() => setFontSize(s => Math.max(10, s - 1))}
            className="chordpro-font-btn"
          >
            <ChevronDown size={14} />
          </button>
          <span className="chordpro-font-size">{fontSize}px</span>
          <button
            onClick={() => setFontSize(s => Math.min(28, s + 1))}
            className="chordpro-font-btn"
          >
            <ChevronUp size={14} />
          </button>
        </div>

        <button
          onClick={onClose}
          className="modal-close"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="chordpro-scroll">
        <div
          className="chordpro-render chordpro-content"
          style={{ fontSize: fontSize }}
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      </div>
    </div>
  )
}
