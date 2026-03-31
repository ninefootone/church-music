'use client'

interface LyricsDisplayProps {
  lyrics: string
  className?: string
}

// Renders **bold** and _italic_ markers in lyrics
export function LyricsDisplay({ lyrics, className }: LyricsDisplayProps) {
  const renderLine = (line: string, key: number) => {
    // Split on **bold** and _italic_ markers
    const parts = line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g)
    return (
      <span key={key}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.slice(2, -2)}</strong>
          }
          if (part.startsWith('_') && part.endsWith('_')) {
            return <em key={i}>{part.slice(1, -1)}</em>
          }
          return part
        })}
      </span>
    )
  }

  const lines = lyrics.split('\n')

  return (
    <div className={`lyrics-text ${className || ''}`}>
      {lines.map((line, i) => (
        <span key={i}>
          {renderLine(line, i)}
          {i < lines.length - 1 && '\n'}
        </span>
      ))}
    </div>
  )
}
