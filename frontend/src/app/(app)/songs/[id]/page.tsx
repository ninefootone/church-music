'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Download, ExternalLink, Edit, Plus, Trash2 } from 'lucide-react'
import { CategoryBadge, KeyBadge } from '@/components/ui/badges'
import { LyricsDisplay } from '@/components/ui/LyricsDisplay'
import { FileUploadModal } from '@/components/ui/FileUploadModal'
import { Song } from '@/types'
import api from '@/lib/api'
import { useChurch } from '@/context/ChurchContext'
import { AddToServiceModal } from '@/components/ui/AddToServiceModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

export default function SongDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { isAdmin, loading: churchLoading } = useChurch()
  const [song, setSong] = useState<Song | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showFullLyrics, setShowFullLyrics] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showAddToService, setShowAddToService] = useState(false)
  const [showDeleteSong, setShowDeleteSong] = useState(false)
  const [showDeleteFile, setShowDeleteFile] = useState<string | null>(null)

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

  if (loading || churchLoading) return <p className="text-muted" style={{ padding: 'var(--space-xl)' }}>Loading…</p>
  if (notFound || !song) return (
    <div style={{ padding: 'var(--space-xl)' }}>
      <p className="text-muted" style={{ marginBottom: 'var(--space-md)' }}>Song not found.</p>
      <Link href="/songs" className="back-link"><ArrowLeft size={14} /> Back to songs</Link>
    </div>
  )

  const mainFiles = (song.files || []).filter(f => f.key_of === song.default_key || !f.key_of)
  const otherFiles = (song.files || []).filter(f => f.key_of && f.key_of !== song.default_key)

  const FileButton = ({ file }: { file: any }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        onClick={() => handleDownload(file.id, file.label)}
        disabled={downloadingId === file.id}
        className="download-btn"
      >
        <Download size={14} />
        {downloadingId === file.id ? 'Downloading…' : file.label}
        {file.key_of && file.key_of !== song.default_key && <KeyBadge keyOf={file.key_of} />}
      </button>
      {isAdmin && (
        <button
          onClick={() => handleDelete(file.id)}
          disabled={deletingId === file.id}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'flex', opacity: deletingId === file.id ? 0.5 : 1 }}
          title="Delete file"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )

  return (
    <div style={{ maxWidth: 'var(--width-app)', margin: '0 auto' }}>
      {showUploadModal && (
        <FileUploadModal
          songId={song.id}
          defaultKey={song.default_key}
          onClose={() => setShowUploadModal(false)}
          onUploaded={fetchSong}
        />
      )}

      {showAddToService && song && (
        <AddToServiceModal
          song={song}
          onClose={() => setShowAddToService(false)}
        />
      )}

      <Link href="/songs" className="back-link"><ArrowLeft size={14} /> Back to songs</Link>

      {/* Header */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="song-detail-header">
          <h1 className="song-detail-title">{song.title}</h1>
          {isAdmin && (
            <div className="song-detail-actions">
              <Link href={`/songs/${song.id}/edit`} className="btn btn-sm btn-secondary"><Edit size={14} /> Edit</Link>
              <button onClick={() => setShowAddToService(true)} className="btn btn-sm btn-primary"><Plus size={14} /> Add to service</button>
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
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {song.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}
              </div>
            </div>
          )}
          {song.bible_references && (
            <div className="meta-row">
              <span className="meta-label">Bible</span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{song.bible_references}</span>
            </div>
          )}
          {song.suggested_arrangement && (
            <div className="meta-row">
              <span className="meta-label">Arrangement</span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{song.suggested_arrangement}</span>
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
          <div style={{ marginBottom: 'var(--space-md)', padding: '12px 16px', background: 'var(--color-neutral-50)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-brand-300)' }}>
            <span className="section-label" style={{ marginBottom: 6, display: 'block' }}>Notes</span>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>{song.notes}</p>
          </div>
        )}

        {/* Lyrics */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="section-label" style={{ marginBottom: 0 }}>Lyrics</span>
            {song.lyrics && (
              <button onClick={() => setShowFullLyrics(!showFullLyrics)} className="btn btn-ghost">
                {showFullLyrics ? 'Collapse' : 'Show full lyrics'}
              </button>
            )}
          </div>
          {song.lyrics ? (
            <div style={{ position: 'relative' }}>
              <div style={{ maxHeight: showFullLyrics ? 'none' : 140, overflow: 'hidden' }}>
                <LyricsDisplay lyrics={song.lyrics} />
              </div>
              {!showFullLyrics && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 56, background: 'linear-gradient(transparent, white)', pointerEvents: 'none' }} />
              )}
            </div>
          ) : (
            <p className="text-muted" style={{ fontStyle: 'italic' }}>
              No lyrics added yet.{' '}
              {song.ccli_number && (
                <a href={`https://songselect.ccli.com/songs/${song.ccli_number}`} target="_blank" rel="noopener noreferrer" className="link">
                  Find them on SongSelect ↗
                </a>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Files */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <span className="section-label" style={{ marginBottom: 0 }}>Files</span>
          {isAdmin && (
            <button onClick={() => setShowUploadModal(true)} className="btn btn-primary btn-sm">
              <Plus size={14} /> Upload file
            </button>
          )}
        </div>

        {song.files && song.files.length > 0 ? (
          <>
            {mainFiles.length > 0 && (
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <p className="downloads-group-label">
                  Main key{song.default_key && <> — <KeyBadge keyOf={song.default_key} /></>}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {mainFiles.map(f => <FileButton key={f.id} file={f} />)}
                </div>
              </div>
            )}
            {otherFiles.length > 0 && (
              <>
                {mainFiles.length > 0 && <div className="divider" />}
                <div>
                  <p className="downloads-group-label">Other keys</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {otherFiles.map(f => <FileButton key={f.id} file={f} />)}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <p className="text-muted" style={{ fontStyle: 'italic' }}>
            No files uploaded yet.
            {isAdmin && <> <button onClick={() => setShowUploadModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', color: 'var(--color-brand-500)', padding: 0 }}>Upload a chord chart or sheet music.</button></>}
          </p>
        )}

        {/* Videos */}
        {((song.videos && song.videos.length > 0) || song.youtube_url) && (
          <>
            <div className="divider" />
            <p className="downloads-group-label">Reference videos</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {song.videos && song.videos.length > 0 ? (
                song.videos.map(v => (
                  <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer" className="youtube-link">
                    <span className="youtube-icon"><span className="youtube-play" /></span>
                    {v.label || 'YouTube video'}
                  </a>
                ))
              ) : song.youtube_url ? (
                <a href={song.youtube_url} target="_blank" rel="noopener noreferrer" className="youtube-link">
                  <span className="youtube-icon"><span className="youtube-play" /></span>
                  YouTube reference video
                </a>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Usage */}
      <div className="card">
        <div className="section-label">Usage</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }} className="usage-stats-grid">
          <div className="stat-box">
            <div className="stat-number">{song.usage?.times_sung || 0}</div>
            <div className="stat-label">Times sung</div>
          </div>
          <div className="stat-box">
            <div className="stat-number">{song.usage?.times_planned || 0}</div>
            <div className="stat-label">Planned</div>
          </div>
          <div className="stat-box">
            <div className="stat-number">{song.usage?.last_sung ? format(parseISO(song.usage.last_sung), 'd MMM') : '—'}</div>
            <div className="stat-label">Last sung</div>
          </div>
        </div>
        {song.recent_services && song.recent_services.length > 0 && (
          <>
            <p className="downloads-group-label">Recent services</p>
            {song.recent_services.map((s: any, i: number) => (
              <Link key={s.id} href={`/services/${s.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < song.recent_services!.length - 1 ? '1px solid var(--color-border)' : 'none', textDecoration: 'none' }}>
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)' }}>
                  {s.service_date ? format(parseISO(s.service_date), 'd MMMM yyyy') : ''}
                </span>
                {s.key_override && <KeyBadge keyOf={s.key_override} />}
                <span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>{s.service_time}</span>
              </Link>
            ))}
          </>
        )}
      </div>
      {isAdmin && (
        <div style={{ marginTop: 'var(--space-md)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowDeleteSong(true)}
            className="btn btn-secondary"
            style={{ color: '#9a3a3a' }}
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
    </div>
  )
}