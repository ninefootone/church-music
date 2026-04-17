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
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-md)' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />

      <div style={{ position: 'relative', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
            Invite a member
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
          Share this invite code with anyone you want to join <strong>{church.name}</strong>.
        </p>

        {/* Invite code */}
        <div style={{ background: 'var(--color-neutral-50)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
            Invite code
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '0.15em', color: 'var(--color-text-primary)', fontFamily: 'monospace', flex: 1 }}>
              {church.invite_code}
            </span>
            <button
              onClick={copyCode}
              className="btn btn-secondary btn-sm"
              style={{ flexShrink: 0 }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div style={{ background: 'var(--color-brand-50)', border: '1px solid var(--color-brand-100)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-brand-700)', lineHeight: 1.6 }}>
            Share the invite link below — it will pre-fill the code for them. They just need to sign in or create a free account first.
          </p>
        </div>

        {/* Role info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-brand-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users size={15} style={{ color: 'var(--color-brand-600)' }} />
            </div>
            <div>
              <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>Members</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Can view songs, add services and build running orders</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield size={15} style={{ color: 'var(--color-accent-dark)' }} />
            </div>
            <div>
              <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>Admins</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Full access — add and edit songs, manage members, church settings</p>
            </div>
          </div>
        </div>

        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
          New members join as <strong>Member</strong> by default. You can promote them to Admin afterwards from the team settings.
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={copyLink} className="btn btn-secondary">
            <Copy size={14} /> Copy invite message
          </button>
          <button onClick={onClose} className="btn btn-primary">Done</button>
        </div>
      </div>
    </div>
  )
}
