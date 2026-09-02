'use client'

import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic } from 'lucide-react'
import { useEffect, useRef } from 'react'

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

// Build the paste-as-plain-text HTML — discards Word/Google-doc markup.
// Adjacent lines become tight <br> breaks within one paragraph; only a blank
// line in the source starts a new paragraph. Leading/trailing blanks are
// dropped so a paste doesn't introduce spurious empty lines.
function plainTextToHtml(text: string): string {
  const blocks = text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/) // one or more blank lines separate paragraphs
    .map(block =>
      block
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('<br>')
    )
    .filter(block => block.length > 0)

  if (blocks.length === 0) return ''
  return blocks.map(block => `<p>${block}</p>`).join('')
}

export function RichTextEditor({
  value,
  onChange,
  classPrefix = 'richtext-editor',
  transformIn = identity,
  hint = 'Select text then B or I to format',
}: RichTextEditorProps) {
  // Ref lets handlePaste (which runs long after creation) reach the live editor.
  const editorRef = useRef<Editor | null>(null)

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
      // Intercept paste inside ProseMirror so it doesn't also run its own
      // default handler — returning true prevents the double insert.
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData('text/plain')
        if (!text) return false
        event.preventDefault()
        editorRef.current?.commands.insertContent(plainTextToHtml(text))
        return true
      },
    },
    immediatelyRender: false,
  })

  // Keep the ref pointing at the current editor for handlePaste.
  editorRef.current = editor

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

  return (
    <div className={`${classPrefix}-wrap`}>
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
