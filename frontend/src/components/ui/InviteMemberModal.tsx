'use client'

import { useState } from 'react'
import { X, Copy, Check, Users, Shield } from 'lucide-react'

interface InviteMemberModalProps {
  church: {
    name: string
    invite_code: string
  }
  onClose: () => void
}

export function InviteMemberModal({ church, onClose }: InviteMemberModalProps) {
  const [copied, setCopied] = useState(false)

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/onboarding?code=${church.invite_code}`
    : `https://app.songstack.church/onboarding?code=${church.invite_code}`

  const copyCode = () => {
    navigator.clipboard.writeText(church.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyLink = () => {
    const text = `You've been invited to join ${church.name} on Song Stack.\n\n1. Go to ${inviteUrl}\n2. Sign in or create a free account\n3. Choose "Join an existing church" and enter this code: ${church.invite_code}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-overlay modal-overlay--front">
      <div onClick={onClose} className="modal-backdrop" />

      <div className="modal-panel modal-panel--sm">
        <div className="modal-header">
          <h2 className="modal-title">Invite a member</h2>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        <p className="modal-body">
          Share this invite code with anyone you want to join <strong>{church.name}</strong>.
        </p>

        {/* Invite code */}
        <div className="invite-code-box">
          <p className="sub-section-label">Invite code</p>
          <div className="code-copy-row">
            <span className="invite-code-display" style={{ flex: 1 }}>
              {church.invite_code}
            </span>
            <button
              onClick={copyCode}
              className="btn btn-secondary btn-sm flex-shrink-0"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="info-box">
          <p className="info-box-text">
            Copy the invite message by clicking the button below – it will contain a link for the user to click. They just need to sign-in or create a free account first.
          </p>
        </div>

        {/* Role info */}
        <div className="role-explain-list">
          <div className="role-explain-row">
            <div className="role-icon-bubble role-icon-bubble--member">
              <Users size={15} className="icon-brand" />
            </div>
            <div>
              <p className="role-explain-title">Members</p>
              <p className="role-explain-desc">Can view songs, add plans and build running orders</p>
            </div>
          </div>
          <div className="role-explain-row">
            <div className="role-icon-bubble role-icon-bubble--admin">
              <Shield size={15} className="icon-accent" />
            </div>
            <div>
              <p className="role-explain-title">Admins</p>
              <p className="role-explain-desc">Full access — add and edit songs, manage members, church settings</p>
            </div>
          </div>
        </div>

        <p className="modal-subtitle">
          New members join as <strong>Member</strong> by default. You can promote them to Admin afterwards from the team settings.
        </p>

        <div className="modal-footer">
          <button onClick={copyLink} className="btn btn-secondary">
            <Copy size={14} /> Copy invite message
          </button>
          <button onClick={onClose} className="btn btn-primary">Done</button>
        </div>
      </div>
    </div>
  )
}
