'use client'

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
  // Replace literal \n newlines that are NOT inside an existing tag
  // with <br> so browsers render them as line breaks
  return html
    // Collapse Windows-style line endings
    .replace(/\r\n/g, '\n')
    // Convert runs of blank lines (paragraph breaks) to a spacer
    .replace(/\n{2,}/g, '\n<br>\n')
    // Convert remaining single newlines to <br>
    .replace(/\n/g, '<br>')
}

export function LyricsDisplay({ lyrics, className }: LyricsDisplayProps) {
  if (!lyrics) return null

  const html = isHTML(lyrics) ? normaliseHTML(lyrics) : markersToHTML(lyrics)

  return (
    <div
      className={`lyrics-text ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}