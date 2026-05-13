'use client'

import { useState, useEffect } from 'react'
import { CalendarOff } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'
import { useChurch } from '@/context/ChurchContext'
import api from '@/lib/api'

interface TeamUnavailabilityEntry {
  id: string
  start_date: string
  end_date: string
  note: string | null
  name: string
  email: string
  image_url?: string
}

export default function TeamUnavailabilityPage() {
  const { church, isAdmin } = useChurch()
  const [entries, setEntries] = useState<TeamUnavailabilityEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!church) return
    api.get('/api/unavailability/team')
      .then(r => setEntries(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [church])

  if (!isAdmin) {
    return (
      <div className="settings-restricted">
        <p className="settings-restricted-text">Only admins can view team unavailability.</p>
      </div>
    )
  }

  const formatDateRange = (entry: TeamUnavailabilityEntry) => {
    const start = parseISO(entry.start_date)
    const end = parseISO(entry.end_date)
    if (entry.start_date === entry.end_date) return format(start, 'd MMM yyyy')
    return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`
  }

  // Group entries by member name
  const grouped = entries.reduce((acc, entry) => {
    const key = entry.email
    if (!acc[key]) acc[key] = { name: entry.name, email: entry.email, image_url: entry.image_url, entries: [] }
    acc[key].entries.push(entry)
    return acc
  }, {} as Record<string, { name: string, email: string, image_url?: string, entries: TeamUnavailabilityEntry[] }>)

  const members = Object.values(grouped).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))

  return (
    <div>
      <div className="settings-page-header">
        <div className="settings-icon-wrap">
          <CalendarOff size={20} color="white" />
        </div>
        <div>
          <h1 className="settings-title">Team Unavailability</h1>
          <p className="settings-subtitle">All declared unavailability across your team</p>
        </div>
      </div>

      <div className="settings-card settings-card--spaced">
        <div className="card-header-row">
          <h2 className="settings-section-heading settings-section-heading--tight">Overview</h2>
          <Link href="/team" className="btn btn-ghost">← Back to team</Link>
        </div>

        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-muted">No unavailability has been declared by any team members yet.</p>
        ) : (
          members.map(member => (
            <div key={member.email} className="team-unavail-member">
              <div className="team-unavail-member-header">
                <div className="member-avatar-wrap">
                  {member.image_url ? (
                    <img src={member.image_url} alt={member.name || member.email} className="member-avatar-img" />
                  ) : (
                    <div className="member-avatar-placeholder">
                      {(member.name || member.email || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <p className="team-unavail-member-name">{member.name || member.email}</p>
              </div>
              <div className="unavailability-list">
                {member.entries.map(entry => (
                  <div key={entry.id} className="unavailability-row">
                    <div className="unavailability-info">
                      <p className="unavailability-dates">{formatDateRange(entry)}</p>
                      {entry.note && <p className="unavailability-note">{entry.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}