'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Music } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [churchName, setChurchName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // TODO: POST /api/churches { name: churchName }
    await new Promise(r => setTimeout(r, 800))
    router.push('/dashboard')
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // TODO: POST /api/churches/join { code: inviteCode }
    await new Promise(r => setTimeout(r, 800))
    router.push('/dashboard')
  }

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: '10px', fontFamily: 'inherit', fontSize: 15, color: 'var(--color-text-primary)', background: 'var(--color-surface)', outline: 'none', marginBottom: '16px' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: 48, height: 48, background: 'var(--color-brand-500)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Music size={24} color="white" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', marginBottom: 8 }}>
            Welcome to Church Music
          </h1>
          <p style={{ fontSize: 15, color: 'var(--color-text-secondary)' }}>
            Get started by creating a new church or joining an existing one.
          </p>
        </div>

        {mode === 'choose' && (
          <div style={{ display: 'grid', gap: '12px' }}>
            <button
              onClick={() => setMode('create')}
              style={{ width: '100%', padding: '20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '14px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)' }}
            >
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>Create a new church</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Set up a song library for your church from scratch</div>
            </button>
            <button
              onClick={() => setMode('join')}
              style={{ width: '100%', padding: '20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '14px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)' }}
            >
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>Join an existing church</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Enter an invite code from your church admin</div>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '24px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '20px' }}>Create your church</h2>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Church name
            </label>
            <input
              style={inputStyle}
              required
              autoFocus
              placeholder="e.g. Endcliffe Church"
              value={churchName}
              onChange={e => setChurchName(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setMode('choose')} className="btn btn-secondary" style={{ flex: 1 }}>Back</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                {loading ? 'Creating…' : 'Create church'}
              </button>
            </div>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '24px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '20px' }}>Join a church</h2>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Invite code
            </label>
            <input
              style={inputStyle}
              required
              autoFocus
              placeholder="Enter the code from your admin"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value.toUpperCase())}
              maxLength={8}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setMode('choose')} className="btn btn-secondary" style={{ flex: 1 }}>Back</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                {loading ? 'Joining…' : 'Join church'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
