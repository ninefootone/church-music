'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic } from 'lucide-react'
import { useEffect } from 'react'

interface LyricsEditorProps {
  value: string
  onChange: (value: string) => void
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
    content: value || '<p></p>',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'lyrics-editor-content',
      },
      transformPastedHTML(html) {
        return html
      },
      transformPastedText(text) {
        // Convert plain text paste to HTML preserving line breaks
        return text
          .split('\n')
          .map(line => `<p>${line || '<br>'}</p>`)
          .join('')
      },
    },
  })

  // Update editor content when value changes externally
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== value && value !== undefined) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false })
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

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--color-surface)' }}>
      <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-neutral-50)' }}>
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
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', alignSelf: 'center', marginLeft: 8 }}>
          Select text then B or I to format
        </span>
      </div>
      <EditorContent
        editor={editor}
        style={{ padding: '12px 16px', minHeight: 280, fontSize: 'var(--text-base)', lineHeight: 1.8 }}
      />
    </div>
  )
}
