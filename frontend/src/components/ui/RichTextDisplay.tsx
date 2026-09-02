'use client'

import DOMPurify from 'dompurify'

interface RichTextDisplayProps {
  /** Sanitised on render. Expected to be TipTap-style HTML (<p>/<strong>/<em>). */
  html: string
  className?: string
  /**
   * Explicit tag allowlist. When provided, ONLY these tags survive and all
   * attributes are stripped — the safe default for public-facing surfaces.
   * When omitted, DOMPurify's default profile is used (broader; kept for
   * legacy lyrics HTML imported from WordPress, which may contain div/h tags).
   */
  allowedTags?: string[]
}

export function RichTextDisplay({ html, className, allowedTags }: RichTextDisplayProps) {
  if (!html) return null

  const safe = allowedTags
    ? DOMPurify.sanitize(html, { ALLOWED_TAGS: allowedTags, ALLOWED_ATTR: [] })
    : DOMPurify.sanitize(html)

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}

/** The allowlist for liturgy/service content on public surfaces. */
export const LITURGY_ALLOWED_TAGS = ['p', 'br', 'strong', 'em']
