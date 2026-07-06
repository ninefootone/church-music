'use client'

import { useState, useEffect } from 'react'
import { X, ChevronUp, ChevronDown } from 'lucide-react'
import DOMPurify from 'dompurify'

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
              setRendered(DOMPurify.sanitize(formatter.format(transposed)))
              return
            }
          }
        }

        setRendered(DOMPurify.sanitize(formatter.format(song)))
      } catch (err) {
        console.error('ChordPro render error:', err)
        // Fallback: show raw content, escaped — never trust unparsed ChordPro as HTML
        const escaped = content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
        setRendered(`<pre style="font-family: monospace; white-space: pre-wrap;">${escaped}</pre>`)
      }
    }
    render()
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
