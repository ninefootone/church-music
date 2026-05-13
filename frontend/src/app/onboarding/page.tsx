'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useAuth, useUser, SignInButton } from '@clerk/nextjs'
import { ArrowLeft } from 'lucide-react'
import api, { setAuthToken } from '@/lib/api'

export default function OnboardingPage() {
  const router = useRouter()
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [churchName, setChurchName] = useState('')
  const [ccliNumber, setCcliNumber] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      setInviteCode(code.toUpperCase())
      setMode('join')
    }
  }, [searchParams])

  const redirectUrl = typeof window !== 'undefined' ? window.location.href : ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function getAuthenticatedApi() {
    const token = await getToken()
    setAuthToken(token)
    return api
  }

  async function subscribeUser() {
    try {
      const email = user?.primaryEmailAddress?.emailAddress
      const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
      if (!email) return
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/mailing/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      })
    } catch {
      // Non-critical — don't block onboarding
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const client = await getAuthenticatedApi()
      await client.post('/api/churches', { name: churchName, ccli_number: ccliNumber || undefined })
      await subscribeUser()
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create church. Please try again.')
      setLoading(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const client = await getAuthenticatedApi()
      await client.post('/api/churches/join', { invite_code: inviteCode })
      await subscribeUser()
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid invite code. Please check and try again.')
      setLoading(false)
    }
  }

  return (
    <div className="onboarding-shell">
      <div className="onboarding-inner">
        <div className="onboarding-header">
          <img src="/logo-strap.svg" alt="Song Stack" className="onboarding-logo" />
          <p className="onboarding-subtitle">
            Get started by creating a new church or joining an existing one.
          </p>
        </div>

        {error && (
          <div className="settings-error">
            {error}
          </div>
        )}

        {mode === 'choose' && (
          <div className="onboarding-choices">
            <button onClick={() => setMode('create')} className="onboarding-choice-btn">
              <div className="onboarding-choice-title">Create a new church</div>
              <div className="onboarding-choice-desc">Set up a song library for your church from scratch</div>
            </button>
            <button onClick={() => setMode('join')} className="onboarding-choice-btn">
              <div className="onboarding-choice-title">Join an existing church</div>
              <div className="onboarding-choice-desc">Enter an invite code from your church admin</div>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="onboarding-panel">
            <h2 className="onboarding-form-title">Create your church</h2>
            <p className="onboarding-tip">
              Tip: include your location if your church name is common, e.g. "Grace Church Sheffield"
            </p>
            <label className="settings-label">
              Church name
            </label>
            <input className="onboarding-input" required autoFocus placeholder="e.g. Endcliffe Church" value={churchName} onChange={e => setChurchName(e.target.value)} />
            <label className="settings-label">
              CCLI Licence Number <span className="label-note">(optional)</span>
            </label>
            <input className="onboarding-input" placeholder="e.g. 123456" value={ccliNumber} onChange={e => setCcliNumber(e.target.value)} />
            <p className="onboarding-ccli-hint">
              Your CCLI licence number allows Song Stack to include it in usage reports. Don't have one? <a href="https://uk.ccli.com" target="_blank" rel="noopener noreferrer" className="link-brand">Get licensed at ccli.com</a>
            </p>
            <div className="btn-group">
              <button type="button" onClick={() => setMode('choose')} className="btn btn-ghost btn-icon-label"><ArrowLeft size={16} /> Back</button>
              <button type="submit" className="btn btn-primary ml-auto" disabled={loading}>
                {loading ? 'Creating…' : 'Create church'}
              </button>
            </div>
          </form>
        )}

        {mode === 'join' && isLoaded && !isSignedIn && (
          <div className="onboarding-panel onboarding-panel--centered">
            <h2 className="onboarding-form-title">Sign in to join</h2>
            <p className="onboarding-tip">
              You need an account to join {inviteCode ? 'this church' : 'a church'}. It only takes a moment.
            </p>
            <SignInButton mode="redirect" forceRedirectUrl={redirectUrl}>
              <button className="btn btn-primary btn-full">Sign in or create an account</button>
            </SignInButton>
          </div>
        )}

        {mode === 'join' && isLoaded && isSignedIn && (
          <form onSubmit={handleJoin} className="onboarding-panel">
            <h2 className="onboarding-form-title onboarding-form-title--lg">Join a church</h2>
            <label className="settings-label">
              Invite code
            </label>
            <input className="onboarding-input" required autoFocus placeholder="Enter the code from your admin" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} maxLength={8} />
            <div className="btn-group">
              <button type="button" onClick={() => setMode('choose')} className="btn btn-ghost btn-icon-label"><ArrowLeft size={16} /> Back</button>
              <button type="submit" className="btn btn-primary ml-auto" disabled={loading}>
                {loading ? 'Joining…' : 'Join church'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
