'use client'

// Rehearsal recordings on the song page — the church's OWN recordings (see claude/rehearsal-recordings.md).
// Members can play/download; editors (can_manage_songs) can upload and delete; everyone else can
// ask the church admins to remove one (emails them — nothing is hidden automatically).

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Music, Download, Trash2, Plus, Play, Flag } from 'lucide-react'
import api from '@/lib/api'
import { KeyBadge } from '@/components/ui/badges'
import { SongFile } from '@/types'

interface RecordingsSectionProps {
  songId: string
  recordings: SongFile[]
  canManage: boolean
  downloadingId: string | null
  deletingId: string | null
  onUpload: () => void
  onDownload: (fileId: string, label: string) => void
  onDelete: (fileId: string) => void
}

export function RecordingsSection({ songId, recordings, canManage, downloadingId, deletingId, onUpload, onDownload, onDelete }: RecordingsSectionProps) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [playError, setPlayError] = useState<string | null>(null)
  const [askingId, setAskingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)
  const [sentIds, setSentIds] = useState<string[]>([])

  // Members who can't upload only see the section when there's something to play.
  if (!canManage && recordings.length === 0) return null

  const play = async (fileId: string) => {
    setPlayError(null)
    setLoadingId(fileId)
    try {
      // Signed URL (1 hour) fetched only when someone presses play.
      const { data } = await api.get(`/api/uploads/songs/${songId}/files/${fileId}/url`)
      setUrls(prev => ({ ...prev, [fileId]: data.url }))
    } catch {
      setPlayError(fileId)
    } finally {
      setLoadingId(null)
    }
  }

  const sendRequest = async (fileId: string) => {
    setSending(true)
    setAskError(null)
    try {
      await api.post(`/api/uploads/songs/${songId}/files/${fileId}/removal-request`, { reason })
      setSentIds(prev => [...prev, fileId])
      setAskingId(null)
      setReason('')
    } catch (err: any) {
      setAskError(err?.response?.data?.error || "Couldn't send your request. Please try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="divider" />
      <div className="card-header-row">
        <p className="downloads-group-label">Rehearsal recordings</p>
        {canManage && (
          <button onClick={onUpload} className="btn btn-primary btn-sm">
            <Plus size={14} /> Upload recording
          </button>
        )}
      </div>

      {recordings.length === 0 ? (
        <p className="text-muted text-italic">
          No recordings yet. Upload a voice memo your team has made — for example guitar or piano and vocal in the key you play it — for people to practise to.
        </p>
      ) : (
        <div className="recording-list">
          {recordings.map(r => {
            const meta = [
              r.uploaded_by_name ? `Added by ${r.uploaded_by_name}` : null,
              r.uploaded_at ? format(parseISO(r.uploaded_at), 'd MMM yyyy') : null,
            ].filter(Boolean).join(' · ')
            return (
              <div key={r.id} className="recording-row">
                <div className="recording-head">
                  <Music size={15} className="icon-muted" />
                  <span className="recording-label">{r.label || 'Recording'}</span>
                  {r.key_of && <KeyBadge keyOf={r.key_of} />}
                  {meta && <span className="recording-meta">{meta}</span>}
                </div>

                {urls[r.id] ? (
                  <audio
                    className="recording-audio"
                    src={urls[r.id]}
                    controls
                    autoPlay
                    preload="none"
                    // An expired link (paused over an hour) → clear it so Play fetches a fresh one.
                    onError={() => setUrls(prev => { const next = { ...prev }; delete next[r.id]; return next })}
                  />
                ) : (
                  <div className="recording-actions">
                    <button onClick={() => play(r.id)} disabled={loadingId === r.id} className="btn btn-secondary btn-sm">
                      <Play size={13} /> {loadingId === r.id ? 'Loading…' : 'Play'}
                    </button>
                  </div>
                )}
                {playError === r.id && <p className="input-error">Couldn&apos;t load this recording. Please try again.</p>}

                <div className="recording-actions">
                  <button onClick={() => onDownload(r.id, r.label)} disabled={downloadingId === r.id} className="btn-inline-link">
                    <Download size={13} /> {downloadingId === r.id ? 'Downloading…' : 'Download'}
                  </button>
                  {canManage ? (
                    <button onClick={() => onDelete(r.id)} disabled={deletingId === r.id} className="btn-inline-link btn-danger-text">
                      <Trash2 size={13} /> Delete
                    </button>
                  ) : sentIds.includes(r.id) ? (
                    <span className="recording-meta">Request sent to your church admins.</span>
                  ) : askingId !== r.id && (
                    <button onClick={() => { setAskingId(r.id); setAskError(null) }} className="btn-inline-link">
                      <Flag size={13} /> Ask to remove
                    </button>
                  )}
                </div>

                {askingId === r.id && (
                  <div className="recording-ask">
                    <label className="label label--xs" htmlFor={`reason-${r.id}`}>Why should it be removed? (optional — sent to your church admins)</label>
                    <textarea
                      id={`reason-${r.id}`}
                      className="input input--sm"
                      rows={3}
                      maxLength={1000}
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="e.g. It's my voice and I'd rather it wasn't shared any more."
                    />
                    {askError && <p className="input-error">{askError}</p>}
                    <div className="btn-group">
                      <button onClick={() => { setAskingId(null); setReason('') }} className="btn btn-secondary btn-sm">Cancel</button>
                      <button onClick={() => sendRequest(r.id)} disabled={sending} className="btn btn-primary btn-sm">
                        {sending ? 'Sending…' : 'Send request'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
