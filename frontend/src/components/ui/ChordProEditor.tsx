'use client'

import { useEffect, useRef, useState } from 'react'
import { RotateCcw, AlertTriangle } from 'lucide-react'
import { renderChordPro } from '@/lib/chordproRender'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

// Full-screen ChordPro editor: raw text on the left, live preview on the right.
// Below 900px wide the two panes become Edit / Preview tabs (see .chordpro-editor CSS).
// State (content, saving, errors) stays in the song page; this component only shows it.

interface ChordProEditorProps {
  title: string
  content: string
  originalContent: string
  hasEdits: boolean
  saving: boolean
  error: string | null
  onChange: (content: string) => void
  onSave: () => void
  onClose: () => void
  onRevert: () => void
}

const RENDER_DELAY_MS = 300

export function ChordProEditor({
  title, content, originalContent, hasEdits, saving, error,
  onChange, onSave, onClose, onRevert,
}: ChordProEditorProps) {
  // Last preview that rendered. Kept on screen while the text has a syntax error, so a
  // half-typed "[G" doesn't blank the preview on every keystroke.
  const [html, setHtml] = useState<string | null>(null)
  const [parseError, setParseError] = useState<{ line: number | null } | null>(null)
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const firstRender = useRef(true)

  useEffect(() => {
    let cancelled = false
    const delay = firstRender.current ? 0 : RENDER_DELAY_MS
    firstRender.current = false
    const timer = setTimeout(() => {
      renderChordPro(content).then(result => {
        if (cancelled) return
        if (result.ok) { setHtml(result.html); setParseError(null) }
        else setParseError({ line: result.line })
      })
    }, delay)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [content])

  const changed = content !== originalContent
  const requestClose = () => { if (changed) setConfirmDiscard(true); else onClose() }

  const errorText = parseError
    ? `${parseError.line ? `Line ${parseError.line}: ` : ''}unfinished chord or {directive} — check for a missing ] or }.`
    : null

  return (
    <div className={tab === 'edit' ? 'chordpro-editor chordpro-editor--tab-edit' : 'chordpro-editor chordpro-editor--tab-preview'}>
      <div className="chordpro-toolbar chordpro-editor-toolbar">
        <span className="chordpro-title">Edit ChordPro · {title}</span>
        <div className="chordpro-editor-actions">
          {hasEdits && (
            <button onClick={onRevert} className="btn btn-secondary btn-sm btn-danger-text">
              <RotateCcw size={13} /> Revert to original
            </button>
          )}
          <button onClick={requestClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button
            onClick={onSave}
            disabled={saving || !changed || !!parseError}
            title={parseError ? 'Fix the ChordPro error before saving' : undefined}
            className="btn btn-primary btn-sm"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="chordpro-editor-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'edit'} onClick={() => setTab('edit')}
          className={tab === 'edit' ? 'chordpro-editor-tab chordpro-editor-tab--active' : 'chordpro-editor-tab'}>Edit</button>
        <button role="tab" aria-selected={tab === 'preview'} onClick={() => setTab('preview')}
          className={tab === 'preview' ? 'chordpro-editor-tab chordpro-editor-tab--active' : 'chordpro-editor-tab'}>Preview</button>
      </div>

      {error && <p className="chordpro-editor-message chordpro-editor-message--error">{error}</p>}

      <div className="chordpro-editor-panes">
        <textarea
          className="chordpro-editor-source"
          value={content}
          onChange={e => onChange(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="ChordPro source"
        />
        <div className="chordpro-editor-preview">
          {errorText && (
            <p className="chordpro-editor-message">
              <AlertTriangle size={14} className="icon-warning" />
              <span>{errorText}{html ? ' The preview shows the last version that worked.' : ''}</span>
            </p>
          )}
          {html !== null && (
            <div className="chordpro-render chordpro-content" dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </div>
      </div>

      {confirmDiscard && (
        <ConfirmModal
          title="Discard changes?"
          message="You have unsaved changes to this ChordPro file. Close without saving?"
          confirmLabel="Discard"
          danger
          onConfirm={onClose}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </div>
  )
}
