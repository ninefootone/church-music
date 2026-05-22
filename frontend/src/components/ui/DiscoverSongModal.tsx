'use client'

import { useEffect, useState } from 'react'
import { X, Music } from 'lucide-react'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
import api from '@/lib/api'

type SongDetail = {
  id: string
  title: string
  author: string | null
  default_key: string | null
  category: string | null
  first_line: string | null
  ccli_number: string | null
  copyright_info: string | null
  share_all_data: boolean
  notes: string | null
  bible_references: string | null
  suggested_arrangement: string | null
  lyrics: string | null
  discover_description: string | null
  discover_image_url: string | null
  tags: { id: string; name: string }[]
}

interface Props {
  songId: string
  onClose: () => void
  canManageSongs: boolean
  importState: 'idle' | 'loading' | 'done' | 'exists' | 'error'
  importedSongId: string | undefined
  onImport: () => void
}

function isHTML(str: string) {
  return /<[a-z][\s\S]*>/i.test(str)
}

function LyricsPreview({ lyrics }: { lyrics: string }) {
  const [expanded, setExpanded] = useState(false)
  const isHtml = isHTML(lyrics)
  const processed = isHtml
    ? lyrics
    : lyrics.replace(/\n/g, '<br />')

  return (
    <div className="discover-modal__lyrics-wrap">
      <div
        className={`lyrics-text discover-modal__lyrics-content${expanded ? ' is-expanded' : ''}`}
        dangerouslySetInnerHTML={{ __html: processed }}
      />
      {!expanded && <div className="discover-modal__lyrics-fade" />}
      <button
        className="discover-modal__lyrics-toggle"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? 'Show less' : 'Show full lyrics'}
      </button>
    </div>
  )
}

export function DiscoverSongModal({
  songId,
  onClose,
  canManageSongs,
  importState,
  importedSongId,
  onImport,
}: Props) {
  const [song, setSong] = useState<SongDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    api.get(`/api/templates/${songId}/detail`)
      .then(res => setSong(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [songId])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const arrangement = song?.suggested_arrangement
    ? song.suggested_arrangement.split(',').map(s => s.trim()).filter(Boolean)
    : []

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-panel discover-modal__panel">
        <div className="modal-header">
          <div>
            {loading ? (
              <h2 className="modal-title">Loading…</h2>
            ) : song ? (
              <>
                <h2 className="modal-title">{song.title}</h2>
                {song.author && (
                  <p className="modal-subtitle" style={{ marginBottom: 0 }}>{song.author}</p>
                )}
              </>
            ) : (
              <h2 className="modal-title">Song not found</h2>
            )}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {loading && <p className="text-muted dash-loading">Loading…</p>}
        {error && <p className="text-sm text-danger">Failed to load song details.</p>}

        {song && !loading && (
          <div className="discover-modal__body">
            {/* Meta badges */}
            <div className="discover-modal__meta">
              {song.category && <CategoryBadge category={song.category as any} />}
              {song.default_key && <KeyBadge keyOf={song.default_key} />}
              {song.share_all_data && (
                <span className="discover-card__files-badge">Lyrics &amp; Files Included</span>
              )}
            </div>

            {/* Description */}
            {song.discover_description && (
              <p className="discover-modal__description">{song.discover_description}</p>
            )}

            {/* Tags */}
            {song.tags.length > 0 && (
              <div className="song-section">
                <p className="discover-modal__label">Tags</p>
                <div className="arrangement-pills">
                  {song.tags.map(t => (
                    <span key={t.id} className="arrangement-pill">{t.name}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Bible references */}
            {song.bible_references && (
              <div className="song-section">
                <p className="discover-modal__label">Bible references</p>
                <p className="discover-modal__value">{song.bible_references}</p>
              </div>
            )}

            {/* Suggested arrangement */}
            {arrangement.length > 0 && (
              <div className="song-section">
                <p className="discover-modal__label">Suggested arrangement</p>
                <div className="arrangement-pills">
                  {arrangement.map((part, i) => (
                    <span key={i} className="arrangement-pill">{part}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {song.notes && (
              <div className="song-section">
                <p className="discover-modal__label">Notes</p>
                <p className="discover-modal__value">{song.notes}</p>
              </div>
            )}

            {/* Copyright */}
            {song.copyright_info && (
              <div className="song-section">
                <p className="discover-modal__label">Copyright</p>
                <p className="discover-modal__value discover-modal__value--muted">{song.copyright_info}</p>
              </div>
            )}

            {/* Lyrics preview */}
            {song.lyrics ? (
              <div className="song-section">
                <p className="discover-modal__label">Lyrics preview</p>
                <LyricsPreview lyrics={song.lyrics} />
              </div>
            ) : (
              <div className="song-section discover-modal__no-lyrics">
                <Music size={16} />
                <p>Lyrics not included — you'll need to add your own or access via SongSelect after adding to your library.</p>
              </div>
            )}

            {/* Footer action */}
            <div className="modal-footer modal-footer--bordered modal-footer--end">
              {!canManageSongs && importState !== 'done' && importState !== 'exists' && (
                <span className="text-muted text-sm">Ask an admin to add this song</span>
              )}
              {canManageSongs && importState === 'idle' && (
                <button className="btn btn-primary" onClick={onImport}>
                  Add to library
                </button>
              )}
              {canManageSongs && importState === 'loading' && (
                <button className="btn btn-primary" disabled>Adding…</button>
              )}
              {(importState === 'done' || importState === 'exists') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="text-muted text-sm">
                    {importState === 'exists' ? 'Already in your library' : '✓ Added'}
                  </span>
                  {importedSongId && (
                    <a href={`/songs/${importedSongId}`} className="btn btn-secondary btn-sm">
                      {!song.share_all_data ? 'Edit to add lyrics & files →' : 'View song →'}
                    </a>
                  )}
                </div>
              )}
              {canManageSongs && importState === 'error' && (
                <span className="text-sm text-danger">Failed — try again</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}