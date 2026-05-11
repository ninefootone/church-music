'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Download, ExternalLink, Edit, Plus, Trash2 } from 'lucide-react'
import { FileRow } from '@/components/ui/FileRow'
import { ChordProViewer } from '@/components/ui/ChordProViewer'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
import { LyricsDisplay } from '@/components/ui/LyricsDisplay'
import { FileUploadModal } from '@/components/ui/FileUploadModal'
import { AddLinkModal } from '@/components/ui/AddLinkModal'
import { Song } from '@/types'
import api from '@/lib/api'
import { useChurch } from '@/context/ChurchContext'
import { AddToPlanModal } from '@/components/ui/AddToPlanModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

export default function SongDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { canManageSongs, loading: churchLoading, church } = useChurch()
  const isMasterLibrary = church?.id === process.env.NEXT_PUBLIC_MASTER_CHURCH_ID
  const [song, setSong] = useState<Song | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showFullLyrics, setShowFullLyrics] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [chordProFile, setChordProFile] = useState<{ content: string; label: string; key: string | null } | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showAddToPlan, setShowAddToPlan] = useState(false)
  const [showDeleteSong, setShowDeleteSong] = useState(false)
  const [retiring, setRetiring] = useState(false)
  const [showDeleteFile, setShowDeleteFile] = useState<string | null>(null)
  const [showAddLink, setShowAddLink] = useState(false)
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
  const [editingLinkForm, setEditingLinkForm] = useState<{ url: string; label: string; link_type: string }>({ url: '', label: '', link_type: 'youtube' })
  const [showDeleteLink, setShowDeleteLink] = useState<string | null>(null)

  const startEditLink = (v: { id: string; url: string; label: string | null; link_type: string | null }) => {
    setEditingLinkId(v.id)
    setEditingLinkForm({ url: v.url, label: v.label || '', link_type: v.link_type || 'youtube' })
  }

  const saveEditLink = async () => {
    if (!song || !editingLinkId) return
    try {
      await api.put(`/api/songs/${song.id}/videos/${editingLinkId}`, editingLinkForm)
      setEditingLinkId(null)
      fetchSong()
    } catch (err) {
      console.error('Failed to update link:', err)
    }
  }

  const confirmDeleteLink = async () => {
    if (!song || !showDeleteLink) return
    try {
      await api.delete(`/api/songs/${song.id}/videos/${showDeleteLink}`)
      setShowDeleteLink(null)
      fetchSong()
    } catch (err) {
      console.error('Failed to delete link:', err)
    }
  }

  const fetchSong = useCallback(() => {
    if (!id || churchLoading) return
    setLoading(true)
    setNotFound(false)
    api.get(`/api/songs/${id}`)
      .then(r => setSong(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id, churchLoading])

  useEffect(() => { fetchSong() }, [fetchSong])

  const handleViewChordPro = async (fileId: string, label: string, key: string | null) => {
    if (!song) return
    try {
      const { data } = await api.get(`/api/uploads/songs/${song.id}/files/${fileId}/url`)
      const response = await fetch(data.url)
      const text = await response.text()
      setChordProFile({ content: text, label, key })
    } catch (err) {
      console.error('Failed to load ChordPro file', err)
    }
  }

  const handleDownload = async (fileId: string, label: string) => {
    if (!song) return
    setDownloadingId(fileId)
    // Open blank window immediately before async call to satisfy iOS Safari popup policy
    const newWindow = window.open('', '_blank')
    try {
      const { data } = await api.get(`/api/uploads/songs/${song.id}/files/${fileId}/url`)
      if (newWindow) {
        newWindow.location.href = data.url
      } else {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('Download failed:', err)
      if (newWindow) newWindow.close()
    } finally {
      setDownloadingId(null)
    }
  }

  const handleRetire = async () => {
    if (!song) return
    setRetiring(true)
    try {
      const { data } = await api.patch(`/api/songs/${song.id}/retire`, { retired: !song.retired })
      setSong(prev => prev ? { ...prev, retired: data.retired } : prev)
    } catch (err) {
      console.error('Failed to update retired status:', err)
    } finally {
      setRetiring(false)
    }
  }

  const handleDelete = (fileId: string) => {
    setShowDeleteFile(fileId)
  }

  const confirmDeleteFile = async () => {
    if (!song || !showDeleteFile) return
    setDeletingId(showDeleteFile)
    setShowDeleteFile(null)
    try {
      await api.delete(`/api/uploads/songs/${song.id}/files/${showDeleteFile}`)
      fetchSong()
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading || churchLoading) return <p className="text-muted dash-loading">Loading…</p>
  if (notFound || !song) return (
    <div className="dash-loading">
      <p className="text-muted page-error-msg">Song not found.</p>
      <Link href="/songs" className="back-link"><ArrowLeft size={14} /> Back to songs</Link>
    </div>
  )

  function renderArrangement(value: string) {
    if (!value) return null
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return (
          <div className="arrangement-pills">
            {parsed.map((label: string, i: number) => (
              <span key={i} className="arrangement-pill">{label}</span>
            ))}
          </div>
        )
      }
    } catch {}
    // Legacy plain text fallback
    return <p className="detail-text">{value}</p>
  }

  const mainFiles = (song.files || []).filter(f => f.key_of === song.default_key || !f.key_of)
  const otherFiles = (song.files || []).filter(f => f.key_of && f.key_of !== song.default_key)

  return (
    <div className="page-constrained">
      {chordProFile && (
        <ChordProViewer
          content={chordProFile.content}
          originalKey={chordProFile.key}
          songKey={song.default_key}
          label={chordProFile.label}
          onClose={() => setChordProFile(null)}
        />
      )}

      {showAddLink && (
        <AddLinkModal
          songId={song.id}
          onClose={() => setShowAddLink(false)}
          onSaved={fetchSong}
        />
      )}

      {showUploadModal && (
        <FileUploadModal
          songId={song.id}
          defaultKey={song.default_key}
          onClose={() => setShowUploadModal(false)}
          onUploaded={fetchSong}
        />
      )}

      {showAddToPlan && song && (
        <AddToPlanModal
          song={song}
          onClose={() => setShowAddToPlan(false)}
        />
      )}

      <Link href="/songs" className="back-link"><ArrowLeft size={14} /> Back to songs</Link>

      {/* Header */}
      <div className="card card--spaced">
        <div className="song-detail-header">
          <h1 className="song-detail-title">
            {song.title}
            {song.retired && (
              <span className="song-retired-badge">Retired</span>
            )}
          </h1>
          {canManageSongs && (
            <div className="song-detail-actions">
              <Link href={`/songs/${song.id}/edit`} className="btn btn-sm btn-secondary"><Edit size={14} /> Edit</Link>
              <button onClick={() => setShowAddToPlan(true)} className="btn btn-sm btn-primary"><Plus size={14} /> Add to plan</button>
            </div>
          )}
        </div>
        <p className="song-detail-author">{song.author}</p>

        <div className="meta-block">
          {song.category && (
            <div className="meta-row">
              <span className="meta-label">Category</span>
              <CategoryBadge category={song.category} />
            </div>
          )}
          {song.default_key && (
            <div className="meta-row">
              <span className="meta-label">Key</span>
              <KeyBadge keyOf={song.default_key} />
            </div>
          )}
          {song.first_line && (
            <div className="meta-row">
              <span className="meta-label">First line</span>
              <span className="first-line-text">&ldquo;{song.first_line}&rdquo;</span>
            </div>
          )}
          {song.tags && song.tags.length > 0 && (
            <div className="meta-row">
              <span className="meta-label">Tags</span>
              <div className="tag-list">
                {song.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}
              </div>
            </div>
          )}
          {song.bible_references && (
            <div className="meta-row">
              <span className="meta-label">Bible</span>
              <span className="meta-value">{song.bible_references}</span>
            </div>
          )}
          {song.ccli_number && (
            <div className="meta-row">
              <span className="meta-label">CCLI</span>
              <span className="ccli-number">{song.ccli_number}</span>
              <a href={`https://songselect.ccli.com/songs/${song.ccli_number}`} target="_blank" rel="noopener noreferrer" className="ccli-link">
                View on SongSelect <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>

        {/* Notes */}
        {song.notes && (
          <div className="song-notes-block">
            <span className="section-label section-label--tight">Notes</span>
            <p className="detail-text">{song.notes}</p>
          </div>
        )}

        {/* Lyrics */}
        <div>
          <div className="card-header-row">
            <span className="section-label section-label--flush">Lyrics</span>
            {song.lyrics && (
              <button onClick={() => setShowFullLyrics(!showFullLyrics)} className="btn btn-ghost">
                {showFullLyrics ? 'Collapse' : 'Show full lyrics'}
              </button>
            )}
          </div>
          {song.lyrics ? (
            <div className="lyrics-wrap">
              <div style={{ maxHeight: showFullLyrics ? 'none' : 140, overflow: 'hidden' }}>
                <LyricsDisplay lyrics={song.lyrics} />
              </div>
              {!showFullLyrics && (
                <div className="lyrics-fade" />
              )}
            </div>
          ) : (
            <p className="text-muted text-italic">
              No lyrics added yet.{' '}
              {song.ccli_number && (
                <a href={`https://songselect.ccli.com/songs/${song.ccli_number}`} target="_blank" rel="noopener noreferrer" className="link">
                  Find them on SongSelect ↗
                </a>
              )}
            </p>
          )}
        </div>

        {song.suggested_arrangement && (
          <div className="song-section">
            <span className="section-label section-label--tight">Arrangement</span>
            {renderArrangement(song.suggested_arrangement)}
          </div>
        )}

        {song.copyright_info && (
          <div className="song-section--bordered">
            <span className="section-label section-label--tight">Copyright</span>
            <p className="detail-text">
              {song.copyright_info}
            </p>
            {song.copyright_link && (
                <a href={song.copyright_link}
                target="_blank"
                rel="noopener noreferrer"
                className="copyright-link"
              >
                {song.copyright_link}
              </a>
            )}
          </div>
        )}

        {isMasterLibrary && (song.in_discover || song.share_all_data) && (
          <div className="song-section--bordered">
            <span className="section-label section-label--tight">Master library</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
              {song.share_all_data && (
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>✓ Share all data enabled</span>
              )}
              {song.in_discover && (
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>✓ Added to Discover</span>
              )}
              {song.in_discover && song.discover_description && (
                <p className="detail-text" style={{ marginTop: '0.5rem' }}>{song.discover_description}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Files */}
      <div className="card card--spaced">
        <div className="card-header-row">
          <span className="section-label section-label--flush">Files</span>
          {canManageSongs && (
            <button onClick={() => setShowUploadModal(true)} className="btn btn-primary btn-sm">
              <Plus size={14} /> Upload file
            </button>
          )}
        </div>

        {song.files && song.files.length > 0 ? (
          <>
            {mainFiles.length > 0 && (
              <div className="card--spaced">
                <p className="downloads-group-label">
                  Main key{song.default_key && <> — <KeyBadge keyOf={song.default_key} /></>}
                </p>
                <div className="file-group">
                  {mainFiles.map(f => (
                    <FileRow key={f.id} file={f} songId={song.id} defaultKey={song.default_key} isAdmin={canManageSongs} downloadingId={downloadingId} deletingId={deletingId} onDownload={handleDownload} onDelete={handleDelete} onSaved={fetchSong} onView={f.file_type === 'chordpro' ? handleViewChordPro : undefined} />
                  ))}
                </div>
              </div>
            )}
            {otherFiles.length > 0 && (
              <>
                {mainFiles.length > 0 && <div className="divider" />}
                <div>
                  <p className="downloads-group-label">Other keys</p>
                  <div className="file-group">
                  {otherFiles.map(f => (
                    <FileRow key={f.id} file={f} songId={song.id} defaultKey={song.default_key} isAdmin={canManageSongs} downloadingId={downloadingId} deletingId={deletingId} onDownload={handleDownload} onDelete={handleDelete} onSaved={fetchSong} onView={f.file_type === 'chordpro' ? handleViewChordPro : undefined} />
                  ))}
                </div>
                </div>
              </>
            )}
          </>
        ) : (
          <p className="text-muted text-italic">
            No files uploaded yet.
            {canManageSongs && <> <button onClick={() => setShowUploadModal(true)} className="btn-inline-link">Upload a chord chart or sheet music.</button></>}
          </p>
        )}

        {/* Links */}
        {(song.videos && song.videos.length > 0 || canManageSongs) && (
          <>
            <div className="divider" />
            <div className="card-header-row">
              <p className="downloads-group-label">Links</p>
              {canManageSongs && (
                <button onClick={() => setShowAddLink(true)} className="btn btn-primary btn-sm">
                  <Plus size={14} /> Add link
                </button>
              )}
            </div>
            <div className="link-list">
              {(song.videos || []).map(v => {
                const typeLabel = v.link_type === 'spotify' ? 'Spotify'
                  : v.link_type === 'apple_music' ? 'Apple Music'
                  : v.link_type === 'other' ? 'Link'
                  : 'YouTube'
                const displayLabel = v.label || typeLabel

                if (canManageSongs && editingLinkId === v.id) {
                  return (
                    <div key={v.id} className="link-edit-form">
                      <select className="input input--sm" value={editingLinkForm.link_type} onChange={e => setEditingLinkForm(f => ({ ...f, link_type: e.target.value }))}>
                        <option value="youtube">YouTube</option>
                        <option value="spotify">Spotify</option>
                        <option value="apple_music">Apple Music</option>
                        <option value="other">Other</option>
                      </select>
                      <input className="input input--sm" placeholder="URL" value={editingLinkForm.url} onChange={e => setEditingLinkForm(f => ({ ...f, url: e.target.value }))} />
                      <input className="input input--sm" placeholder="Label (optional)" value={editingLinkForm.label} onChange={e => setEditingLinkForm(f => ({ ...f, label: e.target.value }))} />
                      <div className="link-edit-footer">
                        <button onClick={() => setShowDeleteLink(v.id)} className="btn btn-secondary btn-sm btn-danger-text"><Trash2 size={13} /> Delete</button>
                        <div className="btn-group">
                          <button onClick={() => setEditingLinkId(null)} className="btn btn-secondary btn-sm">Cancel</button>
                          <button onClick={saveEditLink} className="btn btn-primary btn-sm">Save</button>
                        </div>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={v.id} className="link-row">
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="youtube-link link-row-anchor">
                      <ExternalLink size={14} />
                      <span className="link-label">{displayLabel}</span>
                      <span className="link-type-label">({typeLabel})</span>
                    </a>
                    {canManageSongs && (
                      <button onClick={() => startEditLink(v)} className="btn btn-secondary btn-sm link-edit-btn"><Edit size={13} /></button>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Usage */}
      <div className="card">
        <div className="section-label">Usage</div>
        <div className="usage-stats-grid">
          <div className="stat-box">
            <div className="stat-number">{song.usage?.times_sung || 0}</div>
            <div className="stat-label">Times sung</div>
          </div>
          <div className="stat-box">
            <div className="stat-number">{song.usage?.times_planned || 0}</div>
            <div className="stat-label">Planned</div>
          </div>
          <div className="stat-box">
            <div className="stat-number">{song.usage?.last_sung ? format(parseISO(song.usage.last_sung), 'd MMMM yyyy') : '—'}</div>
            <div className="stat-label">Last sung</div>
          </div>
          <div className="stat-box">
            <div className="stat-number">{song.usage?.next_planned ? format(parseISO(song.usage.next_planned), 'd MMMM yyyy') : '—'}</div>
            <div className="stat-label">Next planned</div>
          </div>
        </div>
        {song.recent_plans && song.recent_plans.length > 0 && (
          <>
            <p className="downloads-group-label">Recent plans</p>
            {song.recent_plans.map((s: any, i: number) => (
              <Link key={s.id} href={`/plans/${s.id}`} className="recent-plan-row" style={{ borderBottom: i < song.recent_plans!.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <span className="recent-plan-date">
                  {s.plan_date ? format(parseISO(s.plan_date), 'd MMMM yyyy') : ''}
                </span>
                {s.key_override && <KeyBadge keyOf={s.key_override} />}
                <span className="text-muted recent-plan-time">{s.plan_time}</span>
              </Link>
            ))}
          </>
        )}
      </div>
      {canManageSongs && (
        <div className="song-actions-footer">
          <button
            onClick={handleRetire}
            className="btn btn-secondary"
            disabled={retiring}
          >
            {song?.retired ? 'Restore song' : 'Retire song'}
          </button>
          <button
            onClick={() => setShowDeleteSong(true)}
            className="btn btn-secondary btn-danger-text"
          >
            <Trash2 size={14} /> Delete song
          </button>
        </div>
      )}
      {showDeleteSong && (
        <ConfirmModal
          title="Delete song"
          message="Are you sure you want to delete this song? This cannot be undone."
          confirmLabel="Delete song"
          danger
          onConfirm={async () => {
            await api.delete(`/api/songs/${song.id}`)
            router.push('/songs')
          }}
          onCancel={() => setShowDeleteSong(false)}
        />
      )}
      {showDeleteFile && (
        <ConfirmModal
          title="Delete file"
          message="Are you sure you want to delete this file?"
          confirmLabel="Delete file"
          danger
          onConfirm={confirmDeleteFile}
          onCancel={() => setShowDeleteFile(null)}
        />
      )}
      {showDeleteLink && (
        <ConfirmModal
          title="Delete link"
          message="Are you sure you want to delete this link?"
          confirmLabel="Delete link"
          danger
          onConfirm={confirmDeleteLink}
          onCancel={() => setShowDeleteLink(null)}
        />
      )}
    </div>
  )
}
