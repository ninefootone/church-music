'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic } from 'lucide-react'
import { useEffect } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  /**
   * CSS class prefix — the component builds `${classPrefix}-wrap`,
   * `-toolbar`, `-hint`, `-input`, `-content`. Defaults to a neutral
   * "richtext-editor"; the lyrics wrapper passes "lyrics-editor" to keep
   * its existing styling byte-identical.
   */
  classPrefix?: string
  /**
   * Optional transform applied to incoming `value` before it reaches the
   * editor (e.g. lyrics' WordPress-HTML→TipTap conversion). Liturgy content
   * is already clean TipTap HTML, so it uses the identity default.
   */
  transformIn?: (value: string) => string
  hint?: string
}

const identity = (v: string) => v || '<p></p>'

export function RichTextEditor({
  value,
  onChange,
  classPrefix = 'richtext-editor',
  transformIn = identity,
  hint = 'Select text then B or I to format',
}: RichTextEditorProps) {
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
        strike: false, // only bold + italic are offered
      }),
    ],
    content: transformIn(value),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: `${classPrefix}-content`,
      },
    },
    immediatelyRender: false,
  })

  // Sync when the value changes from outside the editor.
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== value && value !== undefined) {
      editor.commands.setContent(transformIn(value), { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        e.preventDefault() // keep editor focus/selection
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

  // Paste as plain text only — discards Word/Google-doc HTML soup at the door.
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
    <div onPaste={handlePaste} className={`${classPrefix}-wrap`}>
      <div className={`${classPrefix}-toolbar`}>
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
        <span className={`${classPrefix}-hint`}>{hint}</span>
      </div>
      <EditorContent editor={editor} className={`${classPrefix}-input`} />
    </div>
  )
}
