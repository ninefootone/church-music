'use client'

import { RichTextDisplay } from './RichTextDisplay'

interface LyricsDisplayProps {
  lyrics: string
  className?: string
}

// Detects whether lyrics are stored as HTML or plain text with ** markers
function isHTML(str: string) {
  return /<[a-z][\s\S]*>/i.test(str.trim())
}

// Convert legacy ** and _ markers to HTML
function markersToHTML(text: string) {
  return text
    .split('\n')
    .map(line => {
      let html = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
      return `<p>${html || '<br>'}</p>`
    })
    .join('')
}

// Normalise HTML from WordPress:
// - bare \n newlines inside or between block elements become <br> tags
// - ensures consistent line breaks regardless of how WP exported them
function normaliseHTML(html: string): string {
  return html
    .replace(/\r\n/g, '\n')
    .replace(/<\/(p|div|h[1-6])>\s*\n+\s*<(p|div|h[1-6])/gi, '</$1>\n<$2')
    .replace(/\n{2,}/g, '<br>')
    .replace(/\n/g, '<br>')
}

// Thin wrapper around the shared RichTextDisplay. Keeps the lyrics-specific
// legacy-marker/WordPress preprocessing and the broad default sanitiser
// profile (legacy imported lyrics may contain div/h tags), while sharing the
// single sanitise-and-render path.
export function LyricsDisplay({ lyrics, className }: LyricsDisplayProps) {
  if (!lyrics) return null

  const html = isHTML(lyrics) ? normaliseHTML(lyrics) : markersToHTML(lyrics)

  return (
    <RichTextDisplay
      html={html}
      className={`lyrics-text ${className || ''}`}
    />
  )
}
