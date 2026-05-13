'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ChevronDown, ChevronUp, FileText, ExternalLink, PlayCircle } from 'lucide-react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL

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
        const res = await axios.get(`${API}/api/uploads/public/songs/${item.song_id}/files`)
        setFiles(res.data)
      } catch (err) {
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
      <div
        className="item-row"
        style={{ cursor: isSong ? 'pointer' : 'default' }}
        onClick={isSong ? handleExpand : undefined}
      >
        <span className="item-index">
          {index + 1}
        </span>

        <div className="dash-row-content">
          <p className="item-title" style={{ fontWeight: isSong ? 600 : 400, color: isSong ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
            {isSong && item.song_title ? item.song_title : (item.title || item.type)}
          </p>
          {item.notes && (
            <p className="item-notes">{item.notes}</p>
          )}
        </div>

        <div className="item-right">
          {isSong && (item.key_override || item.song_default_key) && (
            <span className="badge-key">{(item.key_override || item.song_default_key || '').replace(/♯/g, '#').replace(/♭/g, 'b')}</span>
          )}
          {isSong && item.song_youtube_url && (
            <a
              href={item.song_youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="yt-btn"
            >
              <span className="youtube-play" />
            </a>
          )}
          {isSong && (
            <span className="item-chevron">
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          )}
        </div>
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
                      <span className="badge-key">{file.key_of.replace(/♯/g, '#').replace(/♭/g, 'b')}</span>
                    )}
                    <ExternalLink size={12} className="icon-faded" />
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted text-italic">
              No sheet music uploaded for this song yet.
            </p>
          )}

          {(item.custom_arrangement || item.song_suggested_arrangement) && (() => {
            const raw = item.custom_arrangement || item.song_suggested_arrangement
            try {
              const parts: string[] = JSON.parse(raw)
              if (Array.isArray(parts)) return (
                <div className="song-section">
                  <p className="sub-section-label">Arrangement</p>
                  <div className="pill-row">
                    {parts.map((label: string, i: number) => (
                      <span key={i} className="arrangement-pill arrangement-pill-sm">{label}</span>
                    ))}
                  </div>
                </div>
              )
            } catch {}
            return (
              <p className="item-footnote">
                {raw}
              </p>
            )
          })()}
          {item.song_ccli_number && (
            <p className="item-footnote">
              CCLI {item.song_ccli_number}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function PublicPlanPage() {
  const { token } = useParams()
  const [plan, setPlan] = useState<any>(null)
  const [musicians, setMusicians] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    axios.get(`${API}/api/plans/public/${token}`)
      .then(r => {
        setPlan(r.data)
        return axios.get(`${API}/api/plans/${r.data.id}/musicians`)
      })
      .then(r => setMusicians(r.data))
      .catch((err) => {
        if (!plan) setError('Plan not found')
      })
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div className="fullscreen-center">
      <p className="text-muted">Loading...</p>
    </div>
  )

  if (error || !plan) return (
    <div className="fullscreen-center">
      <p className="text-muted">Plan not found.</p>
    </div>
  )

  return (
    <div className="app-shell">
      <nav className="public-nav">
        <div className="public-nav-inner">
          <img src="/logo.svg" alt="Song Stack" className="public-nav-logo" />
          <span className="public-nav-label">View only</span>
        </div>
      </nav>

      <main className="public-main">
        <div className="public-plan-header">
          <h1 className="page-title page-title--tight">
            {format(parseISO(plan.plan_date), 'd MMMM yyyy')}
          </h1>
          {plan.plan_time && (
            <p className="plan-detail-meta">{plan.plan_time}</p>
          )}
          {plan.title && (
            <p className="plan-detail-meta">{plan.title}</p>
          )}
          <div className="public-set-cta">
            <a href={`/s/${token}/set`} className="btn-set-mode">
              <PlayCircle size={15} />
              Set mode
            </a>
          </div>
        </div>

        {musicians.length > 0 && (
          <p className="public-musicians">
            {Object.values(
              musicians.reduce((acc: any, m: any) => {
                const key = m.user_id || m.name
                if (!acc[key]) acc[key] = { name: m.name, roles: [] }
                acc[key].roles.push(m.role)
                return acc
              }, {})
            ).map((g: any) => `${g.name} (${g.roles.join(', ')})`).join(' · ')}
          </p>
        )}

        {(!plan.items || plan.items.length === 0) ? (
          <p className="text-muted">No items in this plan yet.</p>
        ) : (
          <>
            <p className="plan-hint">
              Tap a song to view sheet music
            </p>
            {plan.items.map((item: any, i: number) => (
              <SongItem key={i} item={item} index={i} />
            ))}
          </>
        )}
      </main>

      <footer className="app-footer">
        Song Stack &mdash; shared by your church
      </footer>
    </div>
  )
}
