'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Share2, Plus, Music, BookOpen, Mic2, Trash2, ChevronDown, ChevronUp, FileText, ExternalLink, X, PlayCircle, Mail } from 'lucide-react'
import { KeyBadge, CategoryBadge } from '@/components/ui/badges'
import { useAuth } from '@clerk/nextjs'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { PlanMusicianModal } from '@/components/ui/PlanMusicianModal'
import { PlanEmailModal } from '@/components/ui/PlanEmailModal'
import type { PlanMusician } from '@/types'

interface SongFile {
  id: string
  label: string
  file_type: string
  key_of: string | null
  url: string
}

function renderNotes(text: string) {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={j}>{part.slice(2, -2)}</strong>
      if (part.startsWith('_') && part.endsWith('_')) return <em key={j}>{part.slice(1, -1)}</em>
      return part
    })
    return <span key={i}>{parts}{i < text.split('\n').length - 1 && <br />}</span>
  })
}

function SongItem({ item, index, planId, canAnnotate, showTimings, showDurations, calculatedStart }: { item: any; index: number; planId: string; canAnnotate: boolean; showTimings?: boolean; showDurations?: boolean; calculatedStart?: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const [files, setFiles] = useState<SongFile[] | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(item.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    try {
      await api.patch(`/api/plans/${planId}/items/${item.id}/notes`, { notes })
      item.notes = notes
      setEditingNotes(false)
    } catch {
      // leave editing open on error
    } finally {
      setSavingNotes(false)
    }
  }

  const handleExpand = async () => {
    if (!expanded && item.song_id && files === null) {
      setLoadingFiles(true)
      try {
        const res = await api.get(`/api/uploads/public/songs/${item.song_id}/files`)
        setFiles(res.data)
      } catch {
        setFiles([])
      } finally {
        setLoadingFiles(false)
      }
    }
    setExpanded(!expanded)
  }

  const isSong = item.type === 'song'

  return (
    <div className="song-item-card">
      {(showTimings || showDurations) && (
        <div className="item-timing-row">
          {showTimings && calculatedStart && (
            <span className="item-timing-time">{calculatedStart}</span>
          )}
          {showDurations && item.duration_minutes && (
            <span className="item-timing-duration-label">{item.duration_minutes} min</span>
          )}
        </div>
      )}
      <div
        className="plan-item-row" style={{ cursor: isSong ? 'pointer' : 'default' }}
        onClick={isSong ? handleExpand : undefined}
      >
        <span className="item-index">
          {index + 1}
        </span>
        <div className="dash-row-content">
          <p style={{ fontSize: 'var(--text-md)', fontWeight: isSong ? 600 : 400, color: isSong ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', marginBottom: 0 }}>
            {isSong && item.song_title ? item.song_title : (item.title || item.type.charAt(0).toUpperCase() + item.type.slice(1))}
          </p>
          {editingNotes ? (
            <div style={{ marginTop: 4 }} onClick={e => e.stopPropagation()}>
              <textarea
                className="input notes-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Escape') { setNotes(item.notes || ''); setEditingNotes(false) }
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSaveNotes()
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button className="btn btn-primary btn-xs" onClick={handleSaveNotes} disabled={savingNotes}>
                  {savingNotes ? 'Saving…' : 'Save'}
                </button>
                <button className="btn btn-secondary btn-xs" onClick={() => { setNotes(item.notes || ''); setEditingNotes(false) }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {notes && <p className="item-notes">{renderNotes(notes)}</p>}
              {canAnnotate && (
                <button
                  className="btn-inline-link"
                  onClick={e => { e.stopPropagation(); setEditingNotes(true) }}
                >
                  {notes ? 'Edit note' : '+ Add note'}
                </button>
              )}
            </>
          )}
        </div>
        {isSong && (
          <div className="plan-item-pills">
            {(item.key_override || item.song_default_key) && (
              <KeyBadge keyOf={item.key_override || item.song_default_key} />
            )}
            {item.song_category && (
              <CategoryBadge category={item.song_category} />
            )}
            <span className="item-chevron">
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </div>
        )}
      </div>

      {isSong && expanded && (
        <div className="item-expanded">
          {loadingFiles ? (
            <p className="item-detail-text">Loading files...</p>
          ) : files && files.length > 0 ? (
            <div>
              <p className="sub-section-label">Sheet music</p>
              <div className="file-group">
                {files.map(file => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="file-download-btn"
                  >
                    <FileText size={14} />
                    {file.label}
                    {file.key_of && (
                      <span className="badge-key">{file.key_of}</span>
                    )}
                    <ExternalLink size={12} className="icon-faded" />
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <p className="form-empty-note text-muted">
              No sheet music uploaded for this song yet.
            </p>
          )}
          {(item.custom_arrangement || item.song_suggested_arrangement) && (() => {
            const raw = item.custom_arrangement || item.song_suggested_arrangement
            try {
              const parts: string[] = JSON.parse(raw)
              if (Array.isArray(parts)) return (
                <div className="song-section">
                  <p className="sub-section-label">
                    Arrangement{item.custom_arrangement ? <span className="label-note-inline"> (custom)</span> : ''}
                  </p>
                  <div className="pill-row">
                    {parts.map((label: string, i: number) => (
                      <span key={i} className="arrangement-pill arrangement-pill-sm">{label}</span>
                    ))}
                  </div>
                </div>
              )
            } catch {}
            return (
              <p className="item-detail-xs">
                {raw}
              </p>
            )
          })()}
          {item.song_ccli_number && (
            <p className="item-detail-xs">
              CCLI {item.song_ccli_number}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

const typeIcon = (type: string) => {
  if (type === 'song') return <Music size={14} />
  if (type === 'reading') return <BookOpen size={14} />
  if (type === 'sermon') return <Mic2 size={14} />
  return null
}

export default function PlanDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { userId } = useAuth()
  const { church, isAdmin, canAddPlans, canAnnotatePlans, loading: churchLoading } = useChurch()
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showDeletePlan, setShowDeletePlan] = useState(false)
  const [musicians, setMusicians] = useState<PlanMusician[]>([])
  const [unavailableUserIds, setUnavailableUserIds] = useState<Set<string>>(new Set())

  const checkUnavailability = async (musicianList: PlanMusician[], planDate: string) => {
    const userIds = [...new Set<string>(musicianList.map(m => m.user_id).filter(Boolean) as string[])]
    const results = await Promise.all(
      userIds.map(uid =>
        api.get('/api/unavailability/check', { params: { userId: uid, date: planDate } })
          .then(res => res.data.unavailable ? uid : null)
          .catch(() => null)
      )
    )
    setUnavailableUserIds(new Set(results.filter(Boolean) as string[]))
  }
  const [showMusicianModal, setShowMusicianModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)

  useEffect(() => {
    if (!id || churchLoading) return
    setLoading(true)
    api.get(`/api/plans/${id}`)
      .then(r => {
        setPlan(r.data)
        const planDate = r.data.plan_date
        api.get(`/api/plans/${id}/musicians`)
          .then(async mr => {
            setMusicians(mr.data)
            if (planDate) {
              const userIds = [...new Set<string>(mr.data.map((m: PlanMusician) => m.user_id).filter(Boolean))]
              const results = await Promise.all(
                userIds.map(uid =>
                  api.get('/api/unavailability/check', { params: { userId: uid, date: planDate } })
                    .then(res => res.data.unavailable ? uid : null)
                    .catch(() => null)
                )
              )
              setUnavailableUserIds(new Set(results.filter(Boolean) as string[]))
            }
          })
          .catch(() => {})
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id, churchLoading])

  const handleShare = async () => {
    if (!plan) return
    const url = `${window.location.origin}/s/${plan.public_token}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: plan.title,
          url,
          text: `Here's the service plan${plan.plan_date ? ` for ${format(parseISO(plan.plan_date), 'EEEE d MMMM')}` : ''}:`,
        })
      } catch (_) {
        // user dismissed — do nothing
      }
    } else {
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const [showTimings, setShowTimings] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('plan_show_timings') === 'true'
  })
  const [showDurations, setShowDurations] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('plan_show_durations') === 'true'
  })

  if (loading || churchLoading) return <p className="text-muted dash-loading">Loading…</p>
  if (notFound || !plan) return (
    <div className="page-loading-wrap">
      <p className="text-muted page-error-msg">Plan not found.</p>
      <Link href="/plans" className="back-link"><ArrowLeft size={14} /> Back to plans</Link>
    </div>
  )

  return (
    <div>
      <Link href="/plans" className="back-link"><ArrowLeft size={14} /> Back to plans</Link>

      {/* Header */}
      <div className="card card--spaced">
        <div className="plan-detail-header">
          <div className="plan-header-left">
            <h1 className="plan-detail-title">
              {format(parseISO(plan.plan_date), 'd MMMM yyyy')}
            </h1>
            {(plan.plan_start_time || plan.plan_time) && (
              <p className="plan-detail-meta">
                {plan.plan_start_time
                  ? new Date(`1970-01-01T${plan.plan_start_time}`).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
                  : plan.plan_time}
              </p>
            )}
            {plan.items?.length > 0 && (
              <div className="timing-toggles">
                <label className="timing-toggle-label">
                  <input type="checkbox" checked={showTimings} onChange={e => {
                    setShowTimings(e.target.checked)
                    localStorage.setItem('plan_show_timings', String(e.target.checked))
                  }} disabled={!plan.plan_start_time} title={!plan.plan_start_time ? 'No start time set for this plan' : ''} /> Show timings
                </label>
                <label className="timing-toggle-label">
                  <input type="checkbox" checked={showDurations} onChange={e => {
                    setShowDurations(e.target.checked)
                    localStorage.setItem('plan_show_durations', String(e.target.checked))
                  }} /> Show item duration
                </label>
              </div>
            )}
            {plan.title && (
              <p className="plan-detail-meta text-muted">{plan.title}</p>
            )}
          </div>
                    <div className="plan-detail-actions">
            {/* Draft badge — visible to plan editors only */}
            {plan.status === 'draft' && (isAdmin || canAddPlans || plan.created_by === userId) && (
              <span className="badge badge-draft badge-draft--header">DRAFT</span>
            )}

            {/* Share — compact icon+label button */}
            <button
              onClick={handleShare}
              className="btn btn-secondary btn-compact-icon"
              title="Share plan"
            >
              <Share2 size={14} />
              <span>{copied ? 'Copied!' : 'Share'}</span>
            </button>

            {/* Set mode */}
            <Link
              href={`/plans/${id}/set`}
              className="btn btn-secondary btn-compact-icon"
              title="Open set mode"
            >
              <PlayCircle size={14} />
              <span>Set mode</span>
            </Link>

            {/* Email — admin or owner */}
            {(isAdmin || canAddPlans || plan.created_by === userId) && (
              <button
                onClick={() => setShowEmailModal(true)}
                className="btn btn-secondary btn-compact-icon"
                title="Send plan email"
              >
                <Mail size={14} />
                <span>Email</span>
              </button>
            )}

            {/* Edit — admin or owner */}
            {(isAdmin || canAddPlans || plan.created_by === userId) && (
              <Link href={`/plans/${id}/edit`} className="btn btn-primary btn-sm">
                Edit
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Musicians */}
      <div className="card card--spaced">
        <div className="card-header-row">
          <div className="section-label section-label--flush">Musicians</div>
          {(isAdmin || canAddPlans || plan.created_by === userId) && (
            <button
              onClick={() => setShowMusicianModal(true)}
              className="btn btn-secondary btn-xs"
            >
              <Plus size={13} /> Add
            </button>
          )}
        </div>

        {musicians.length === 0 ? (
          <p className="form-empty-note text-muted">
            No musicians added yet.
          </p>
        ) : (
          <div className="file-group">
            {Object.values(
              musicians.reduce((acc, m) => {
                const key = m.user_id || m.name
                if (!acc[key]) acc[key] = { name: m.name, user_id: m.user_id, roles: [], ids: [] }
                acc[key].roles.push(m.role)
                acc[key].ids.push(m.id)
                return acc
              }, {} as Record<string, { name: string; user_id: string | null; roles: string[]; ids: string[] }>)
            ).map(group => (
              <div key={group.ids[0]} className={`musician-chip${group.user_id && unavailableUserIds.has(group.user_id) ? ' musician-chip--unavailable' : ''}`}>
                <span className="musician-name">{group.name}</span>
                <span className="musician-roles">{group.roles.join(', ')}</span>
                {(isAdmin || canAddPlans || plan.created_by === userId) && (
                  <button
                    onClick={async () => {
                      await Promise.all(group.ids.map(rid => api.delete(`/api/plans/${id}/musicians/${rid}`)))
                      setMusicians(prev => prev.filter(m => !group.ids.includes(m.id)))
                    }}
                    className="btn-icon-remove"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Running order */}
      <div className="card">
        <div className="section-label">Running order</div>

        {!plan.items || plan.items.length === 0 ? (
          <div className="card-empty">
            <p className="text-muted empty-message">No items added yet.</p>
            {(isAdmin || canAddPlans || plan.created_by === userId) && (
              <Link href={`/plans/${id}/edit`} className="btn btn-primary btn-sm">
                <Plus size={14} /> Build the running order
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="plan-hint">
              Tap a song to view sheet music
            </p>
            {(() => {
              const startTime = plan.plan_start_time ? plan.plan_start_time.slice(0, 5) : null
              let h = startTime ? parseInt(startTime.split(':')[0]) : 0
              let m = startTime ? parseInt(startTime.split(':')[1]) : 0
              return plan.items.map((item: any, i: number) => {
                const calcStart = startTime ? `${h}:${String(m).padStart(2, '0')}` : null
                const dur = item.duration_minutes ?? 0
                m += dur; h += Math.floor(m / 60); m = m % 60
                return (
                  <SongItem
                    key={item.id}
                    item={item}
                    index={i}
                    planId={id as string}
                    canAnnotate={canAnnotatePlans && !isAdmin && !canAddPlans && plan.created_by !== userId}
                    showTimings={showTimings && !!startTime}
                    showDurations={showDurations}
                    calculatedStart={calcStart}
                  />
                )
              })
            })()}
          </>
        )}
      </div>
      {(isAdmin || canAddPlans || plan.created_by === userId) && (
        <div className="song-actions-footer">
          <button
            onClick={() => setShowDeletePlan(true)}
            className="btn btn-secondary btn-danger-text"
          >
            <Trash2 size={14} /> Delete plan
          </button>
        </div>
      )}
      {showEmailModal && (
        <PlanEmailModal
          planId={id as string}
          onClose={() => setShowEmailModal(false)}
        />
      )}
      {showMusicianModal && (
        <PlanMusicianModal
          planId={id as string}
          planDate={plan?.plan_date ?? ''}
          churchId={church!.id}
          onAdd={newMusicians => {
            setMusicians(prev => {
              const updated = [...prev, ...newMusicians]
              if (plan?.plan_date) checkUnavailability(updated, plan.plan_date)
              return updated
            })
          }}
          onClose={() => setShowMusicianModal(false)}
        />
      )}
      {showDeletePlan && (
        <ConfirmModal
          title="Delete plan"
          message="Are you sure you want to delete this plan? This cannot be undone."
          confirmLabel="Delete plan"
          danger
          onConfirm={async () => {
            await api.delete(`/api/plans/${id}`)
            router.push('/plans')
          }}
          onCancel={() => setShowDeletePlan(false)}
        />
      )}
    </div>
  )
}
