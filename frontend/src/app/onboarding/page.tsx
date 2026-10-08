'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useAuth, SignInButton } from '@clerk/nextjs'
import { ArrowLeft } from 'lucide-react'
import api, { setAuthToken } from '@/lib/api'

export default function OnboardingPage() {
  const router = useRouter()
  const { getToken, isSignedIn, isLoaded } = useAuth()
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

  // One church per person (enforced by the backend too). If the signed-in user already
  // belongs to a church, don't offer create/join: with no invite code just go to the
  // dashboard; with an invite code (they opened someone's link) explain why they can't join.
  // 'checking' hides the choices until we know, so they don't flash up first.
  const [existingChurch, setExistingChurch] = useState<{ name: string } | null | 'checking'>('checking')

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { setExistingChurch(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const token = await getToken()
        setAuthToken(token)
        const { data } = await api.get('/api/churches/mine')
        if (cancelled) return
        if (Array.isArray(data) && data.length > 0) {
          if (!searchParams.get('code')) { router.replace('/dashboard'); return }
          setExistingChurch({ name: data[0].name })
        } else {
          setExistingChurch(null)
        }
      } catch {
        // Couldn't check — show the normal screen; the backend still blocks a second church.
        if (!cancelled) setExistingChurch(null)
      }
    })()
    return () => { cancelled = true }
  }, [isLoaded, isSignedIn, getToken, searchParams, router])

  async function getAuthenticatedApi() {
    const token = await getToken()
    setAuthToken(token)
    return api
  }

  async function subscribeUser() {
    try {
      // Signed-in route: the backend subscribes the account's own email.
      const client = await getAuthenticatedApi()
      await client.post('/api/mailing/subscribe')
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
          <img src="/logo-strap.svg" alt="SongStack" className="onboarding-logo" />
          {existingChurch === null && (
            <p className="onboarding-subtitle">
              Get started by creating a new church or joining an existing one.
            </p>
          )}
        </div>

        {existingChurch !== 'checking' && existingChurch !== null && (
          <div className="onboarding-panel onboarding-panel--centered">
            <h2 className="onboarding-form-title">You're already in a church</h2>
            <p className="onboarding-tip">
              Your account belongs to <strong>{existingChurch.name}</strong>. Song Stack doesn't support
              belonging to more than one church yet. If you need to move, contact{' '}
              <a href="mailto:hello@songstack.church" className="link-brand">hello@songstack.church</a>.
            </p>
            <button type="button" onClick={() => router.push('/dashboard')} className="btn btn-primary btn-full">
              Go to your dashboard
            </button>
          </div>
        )}

        {existingChurch === null && error && (
          <div className="settings-error">
            {error}
          </div>
        )}

        {existingChurch === null && mode === 'choose' && (
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

        {existingChurch === null && mode === 'create' && (
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
              Your CCLI licence number allows SongStack to include it in usage reports. Don't have one? <a href="https://uk.ccli.com" target="_blank" rel="noopener noreferrer" className="link-brand">Get licensed at ccli.com</a>
            </p>
            <div className="btn-group">
              <button type="button" onClick={() => setMode('choose')} className="btn btn-ghost btn-icon-label"><ArrowLeft size={16} /> Back</button>
              <button type="submit" className="btn btn-primary ml-auto" disabled={loading}>
                {loading ? 'Creating…' : 'Create church'}
              </button>
            </div>
          </form>
        )}

        {existingChurch === null && mode === 'join' && isLoaded && !isSignedIn && (
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

        {existingChurch === null && mode === 'join' && isLoaded && isSignedIn && (
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
