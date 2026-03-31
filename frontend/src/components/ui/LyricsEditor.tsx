'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic } from 'lucide-react'

interface LyricsEditorProps {
  value: string
  onChange: (value: string) => void
}

export function LyricsEditor({ value, onChange }: LyricsEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Only keep what we need for lyrics
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
    content: value
      ? value.split('\n').map(line => `<p>${line || '<br/>'}</p>`).join('')
      : '<p></p>',
    onUpdate: ({ editor }) => {
      // Convert back to plain text with newlines
      const html = editor.getHTML()
      const text = html
        .replace(/<p>/g, '')
        .replace(/<\/p>/g, '\n')
        .replace(/<br\s*\/?>/g, '')
        .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
        .replace(/<em>(.*?)<\/em>/g, '_$1_')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .trimEnd()
      onChange(text)
    },
    editorProps: {
      attributes: {
        class: 'lyrics-editor-content',
      },
    },
  })

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
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
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
      {/* Toolbar */}
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
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        style={{ padding: '12px 16px', minHeight: 280, fontSize: 'var(--text-base)', lineHeight: 1.8, color: 'var(--color-text-primary)' }}
      />
    </div>
  )
}