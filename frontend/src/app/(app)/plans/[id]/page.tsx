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

function SongItem({ item, index }: { item: any; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const [files, setFiles] = useState<SongFile[] | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(false)

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
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 8 }}>
      <div
        className="plan-item-row" style={{ cursor: isSong ? 'pointer' : 'default' }}
        onClick={isSong ? handleExpand : undefined}
      >
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', width: 24, textAlign: 'center', flexShrink: 0 }}>
          {index + 1}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 'var(--text-md)', fontWeight: isSong ? 600 : 400, color: isSong ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', marginBottom: 0 }}>
            {isSong && item.song_title ? item.song_title : (item.title || item.type.charAt(0).toUpperCase() + item.type.slice(1))}
          </p>
          {item.notes && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: 2 }}>{item.notes}</p>
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
            <span style={{ color: 'var(--color-text-muted)', display: 'flex' }}>
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </div>
        )}
      </div>

      {isSong && expanded && (
        <div style={{ borderTop: '1px solid var(--color-border)', padding: 'var(--space-md)', background: 'var(--color-neutral-50)' }}>
          {loadingFiles ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Loading files...</p>
          ) : files && files.length > 0 ? (
            <div>
              <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 10 }}>Sheet music</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {files.map(file => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-brand-600)', textDecoration: 'none' }}
                  >
                    <FileText size={14} />
                    {file.label}
                    {file.key_of && (
                      <span className="badge-key" style={{ marginLeft: 2 }}>{file.key_of}</span>
                    )}
                    <ExternalLink size={12} style={{ opacity: 0.5 }} />
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No sheet music uploaded for this song yet.
            </p>
          )}
          {(item.custom_arrangement || item.song_suggested_arrangement) && (() => {
            const raw = item.custom_arrangement || item.song_suggested_arrangement
            try {
              const parts: string[] = JSON.parse(raw)
              if (Array.isArray(parts)) return (
                <div style={{ marginTop: 10 }}>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                    Arrangement{item.custom_arrangement ? <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> (custom)</span> : ''}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {parts.map((label: string, i: number) => (
                      <span key={i} className="arrangement-pill arrangement-pill-sm">{label}</span>
                    ))}
                  </div>
                </div>
              )
            } catch {}
            return (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 10 }}>
                {raw}
              </p>
            )
          })()}
          {item.song_ccli_number && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 10 }}>
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
  const { isAdmin, canEditAnyPlan, loading: churchLoading } = useChurch()
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showDeletePlan, setShowDeletePlan] = useState(false)
  const [musicians, setMusicians] = useState<PlanMusician[]>([])
  const [showMusicianModal, setShowMusicianModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)

  useEffect(() => {
    if (!id || churchLoading) return
    setLoading(true)
    api.get(`/api/plans/${id}`)
      .then(r => setPlan(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
    api.get(`/api/plans/${id}/musicians`)
      .then(r => setMusicians(r.data))
      .catch(() => {})
  }, [id, churchLoading])

  const handleShare = async () => {
    if (!plan) return
    const url = `${window.location.origin}/s/${plan.public_token}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Plan sheet', url })
      } catch (_) {
        // user dismissed — do nothing
      }
    } else {
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading || churchLoading) return <p className="text-muted" style={{ padding: 'var(--space-xl)' }}>Loading…</p>
  if (notFound || !plan) return (
    <div style={{ padding: 'var(--space-xl)' }}>
      <p className="text-muted" style={{ marginBottom: 'var(--space-md)' }}>Plan not found.</p>
      <Link href="/plans" className="back-link"><ArrowLeft size={14} /> Back to plans</Link>
    </div>
  )

  return (
    <div>
      <Link href="/plans" className="back-link"><ArrowLeft size={14} /> Back to plans</Link>

      {/* Header */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="plan-detail-header">
          <div style={{ minWidth: 0 }}>
            <h1 className="plan-detail-title">
              {format(parseISO(plan.plan_date), 'd MMMM yyyy')}
            </h1>
            {plan.plan_time && (
              <p style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-secondary)', marginTop: 2 }}>{plan.plan_time}</p>
            )}
            {plan.title && (
              <p style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-muted)', marginTop: 2 }}>{plan.title}</p>
            )}
          </div>
                    <div className="plan-detail-actions">
            {/* Share — compact icon+label button */}
            <button
              onClick={handleShare}
              className="btn btn-secondary"
              style={{ padding: '7px 10px', fontSize: 'var(--text-xs)', gap: 4 }}
              title="Share plan"
            >
              <Share2 size={14} />
              <span>{copied ? 'Copied!' : 'Share'}</span>
            </button>

            {/* Set mode */}
            <Link
              href={`/plans/${id}/set`}
              className="btn btn-secondary"
              style={{ padding: '7px 10px', fontSize: 'var(--text-xs)', gap: 4 }}
              title="Open set mode"
            >
              <PlayCircle size={14} />
              <span>Set mode</span>
            </Link>

            {/* Email — admin or owner */}
            {(isAdmin || canEditAnyPlan || plan.created_by === userId) && (
              <button
                onClick={() => setShowEmailModal(true)}
                className="btn btn-secondary"
                style={{ padding: '7px 10px', fontSize: 'var(--text-xs)', gap: 4 }}
                title="Send plan email"
              >
                <Mail size={14} />
                <span>Email</span>
              </button>
            )}

            {/* Edit — admin or owner */}
            {(isAdmin || canEditAnyPlan || plan.created_by === userId) && (
              <Link href={`/plans/${id}/edit`} className="btn btn-primary btn-sm">
                Edit
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Musicians */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
          <div className="section-label" style={{ marginBottom: 0 }}>Musicians</div>
          {(isAdmin || canEditAnyPlan || plan.created_by === userId) && (
            <button
              onClick={() => setShowMusicianModal(true)}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 'var(--text-xs)', padding: '5px 10px' }}
            >
              <Plus size={13} /> Add
            </button>
          )}
        </div>

        {musicians.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            No musicians added yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.values(
              musicians.reduce((acc, m) => {
                const key = m.user_id || m.name
                if (!acc[key]) acc[key] = { name: m.name, user_id: m.user_id, roles: [], ids: [] }
                acc[key].roles.push(m.role)
                acc[key].ids.push(m.id)
                return acc
              }, {} as Record<string, { name: string; user_id: string | null; roles: string[]; ids: string[] }>)
            ).map(group => (
              <div key={group.ids[0]} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--color-neutral-50)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{group.name}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{group.roles.join(', ')}</span>
                {(isAdmin || canEditAnyPlan || plan.created_by === userId) && (
                  <button
                    onClick={async () => {
                      await Promise.all(group.ids.map(rid => api.delete(`/api/plans/${id}/musicians/${rid}`)))
                      setMusicians(prev => prev.filter(m => !group.ids.includes(m.id)))
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0, display: 'flex', alignItems: 'center', marginLeft: 2 }}
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
          <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
            <p className="text-muted" style={{ marginBottom: 'var(--space-sm)' }}>No items added yet.</p>
            {(isAdmin || canEditAnyPlan || plan.created_by === userId) && (
              <Link href={`/plans/${id}/edit`} className="btn btn-primary btn-sm">
                <Plus size={14} /> Build the running order
              </Link>
            )}
          </div>
        ) : (
          <>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
              Tap a song to view sheet music
            </p>
            {plan.items.map((item: any, i: number) => (
              <SongItem key={item.id} item={item} index={i} />
            ))}
          </>
        )}
      </div>
      {(isAdmin || canEditAnyPlan || plan.created_by === userId) && (
        <div style={{ marginTop: 'var(--space-md)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowDeletePlan(true)}
            className="btn btn-secondary"
            style={{ color: '#9a3a3a' }}
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
          churchId={church!.id}
          onAdd={musicians => setMusicians(prev => [...prev, ...musicians])}
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
