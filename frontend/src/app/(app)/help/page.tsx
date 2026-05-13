'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { HelpCircle, Mail } from 'lucide-react'
import api from '@/lib/api'

interface Member {
  id: string
  user_id: string
  name: string
  email: string
  image_url?: string
  role: string
}

export default function HelpPage() {
  const [admins, setAdmins] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/members')
      .then(r => setAdmins(r.data.filter((m: Member) => m.role === 'admin')))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="settings-page-header">
        <div className="settings-icon-wrap">
          <HelpCircle size={20} color="white" />
        </div>
        <div>
          <h1 className="settings-title">Help &amp; Support</h1>
          <p className="settings-subtitle">Get help from your church admins or contact Song Stack support</p>
        </div>
      </div>

      {/* Church admin contacts */}
      <div className="settings-card settings-card--spaced">
        <h2 className="settings-section-heading settings-section-heading--tight">Your church admins</h2>
        <p className="settings-section-desc">
          For questions about your song library, plans, or access — get in touch with one of your church admins directly.
        </p>
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : admins.length === 0 ? (
          <p className="text-muted">No admins found.</p>
        ) : (
          <div className="help-admin-list">
            {admins.map(admin => (
              <div key={admin.id} className="help-admin-row">
                <div className="member-avatar-wrap">
                  {admin.image_url ? (
                    <img src={admin.image_url} alt={admin.name || admin.email} className="member-avatar-img" />
                  ) : (
                    <div className="member-avatar-placeholder">
                      {(admin.name || admin.email || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="help-admin-info">
                  <p className="help-admin-name">{admin.name || admin.email}</p>
                  {admin.name && admin.email && (
                    <a href={`mailto:${admin.email}`} className="help-admin-email">
                      <Mail size={13} />{admin.email}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Song Stack support */}
      <div className="settings-card settings-card--spaced">
        <h2 className="settings-section-heading settings-section-heading--tight">Song Stack support</h2>
        <p className="settings-section-desc">
          Found a bug, got a feature request, or just want to say hello? Use the link below to get in touch with the Song Stack team.
        </p>
        <Link href="/feedback" className="btn btn-ghost">
          Contact Song Stack →
        </Link>
      </div>
    </div>
  )
}