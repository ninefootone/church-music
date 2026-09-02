'use client'

import { RichTextEditor } from './RichTextEditor'

interface LyricsEditorProps {
  value: string
  onChange: (value: string) => void
}

// Legacy WordPress-HTML → TipTap normalisation, kept lyrics-specific.
function wpHtmlToTiptap(html: string): string {
  if (!html) return '<p></p>'
  return html
    // Replace <br> and \n with paragraph breaks
    .replace(/<br\s*\/?>/gi, '</p><p>')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      // If line is already wrapped in a block tag leave it
      if (line.match(/^<\/?p|^<\/?div|^<\/?h[1-6]/i)) return line
      return `<p>${line}</p>`
    })
    .join('')
    .replace(/<p><\/p>/g, '<p><br></p>')
    .replace(/<p>(<\/?(strong|em|b|i)>)*<\/p>/g, '<p><br></p>')
}

// Thin wrapper around the shared RichTextEditor — preserves the lyrics-editor-*
// styling and the WordPress content normalisation.
export function LyricsEditor({ value, onChange }: LyricsEditorProps) {
  return (
    <RichTextEditor
      value={value}
      onChange={onChange}
      classPrefix="lyrics-editor"
      transformIn={wpHtmlToTiptap}
    />
  )
}
