'use client'

interface LyricsDisplayProps {
  lyrics: string
  className?: string
}

// Detects whether lyrics are stored as HTML or plain text with ** markers
function isHTML(str: string) {
  return str.trim().startsWith('<')
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

export function LyricsDisplay({ lyrics, className }: LyricsDisplayProps) {
  if (!lyrics) return null

  const html = isHTML(lyrics) ? lyrics : markersToHTML(lyrics)

  return (
    <div
      className={`lyrics-text ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
