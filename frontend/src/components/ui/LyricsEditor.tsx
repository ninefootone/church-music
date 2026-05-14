'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic } from 'lucide-react'
import { useEffect } from 'react'

interface LyricsEditorProps {
  value: string
  onChange: (value: string) => void
}

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

export function LyricsEditor({ value, onChange }: LyricsEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        codeBlock: false,
        horizontalRule: false,
        code: false,
      }),
    ],
    content: wpHtmlToTiptap(value),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'lyrics-editor-content',
      },
    },
  })

  // Update editor content when value changes externally
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== value && value !== undefined) {
      editor.commands.setContent(wpHtmlToTiptap(value), { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) return null

  const ToolbarButton = ({
    onClick,
    isActive,
    title,
    children,
  }: {
    onClick: () => void
    isActive: boolean
    title: string
    children: React.ReactNode
  }) => (
    <button
      type="button"
      onMouseDown={e => {
        e.preventDefault() // Prevent editor losing focus
        onClick()
      }}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 34,
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        background: isActive ? 'var(--color-brand-50)' : 'var(--color-surface)',
        color: isActive ? 'var(--color-brand-600)' : 'var(--color-text-secondary)',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    e.preventDefault()
    const html = text
      .split('\n')
      .map(line => line.trim())
      .map(line => `<p>${line || '<br>'}</p>`)
      .join('')
    editor.commands.insertContent(html)
  }

  return (
    <div onPaste={handlePaste} className="lyrics-editor-wrap">
      <div className="lyrics-editor-toolbar">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold"
        >
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic"
        >
          <Italic size={15} />
        </ToolbarButton>
        <span className="lyrics-editor-hint">
          Select text then B or I to format
        </span>
      </div>
      <EditorContent
        editor={editor}
        className="lyrics-editor-input"
      />
    </div>
  )
}
