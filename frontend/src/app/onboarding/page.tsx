'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useAuth, SignInButton } from '@clerk/nextjs'
import { ArrowLeft } from 'lucide-react'
import api, { setAuthToken } from '@/lib/api'
import { rememberChurchId } from '@/lib/activeChurch'

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

  // /browse (free song library) is deliberately NOT advertised here — it's reached by a link on the
  // Music Ministry site. But someone who has already used it and lands here (e.g. after signing in
  // from the home page) needs a way back. /browse sets this flag; per browser, best effort.
  const [showBrowse, setShowBrowse] = useState(false)
  useEffect(() => {
    try {
      setShowBrowse(localStorage.getItem('songstack.browseUser') === '1')
    } catch {
      // storage blocked — just don't show the link
    }
  }, [])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // People can belong to more than one church. If the signed-in user is already in one and
  // arrived with neither an invite code nor ?add=1 (the "Join or create another church" link
  // in the menu), they didn't mean to be here — send them to the dashboard. Otherwise show the
  // normal choices, with a note naming the church(es) they're already in and a way back.
  // 'checking' hides the choices until we know, so they don't flash up first.
  const [existingChurches, setExistingChurches] = useState<{ name: string }[] | 'checking'>('checking')

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { setExistingChurches([]); return }
    let cancelled = false
    ;(async () => {
      try {
        const token = await getToken()
        setAuthToken(token)
        const { data } = await api.get('/api/churches/mine')
        if (cancelled) return
        if (Array.isArray(data) && data.length > 0) {
          if (!searchParams.get('code') && !searchParams.get('add')) { router.replace('/dashboard'); return }
          setExistingChurches(data.map((c: { name: string }) => ({ name: c.name })))
        } else {
          setExistingChurches([])
        }
      } catch {
        // Couldn't check — just show the normal screen.
        if (!cancelled) setExistingChurches([])
      }
    })()
    return () => { cancelled = true }
  }, [isLoaded, isSignedIn, getToken, searchParams, router])

  const ready = existingChurches !== 'checking'
  const alreadyMember = Array.isArray(existingChurches) && existingChurches.length > 0

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
      const { data: created } = await client.post('/api/churches', { name: churchName, ccli_number: ccliNumber || undefined })
      // Open the dashboard in the new church, not whichever church they were last using.
      if (created?.id) rememberChurchId(created.id)
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
      const { data: joined } = await client.post('/api/churches/join', { invite_code: inviteCode })
      if (joined?.id) rememberChurchId(joined.id)
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
          {existingChurches !== 'checking' && existingChurches.length === 0 && (
            <p className="onboarding-subtitle">
              Get started by creating a new church or joining an existing one.
            </p>
          )}
          {existingChurches !== 'checking' && existingChurches.length > 0 && (
            <p className="onboarding-subtitle">
              You're already in {existingChurches.map(c => c.name).join(', ')}. You can join or create
              another church too — switch between them from the menu.
            </p>
          )}
        </div>

        {ready && error && (
          <div className="settings-error">
            {error}
          </div>
        )}

        {ready && mode === 'choose' && (
          <div className="onboarding-choices">
            <button onClick={() => setMode('create')} className="onboarding-choice-btn">
              <div className="onboarding-choice-title">Create a new church</div>
              <div className="onboarding-choice-desc">Set up a song library for your church from scratch</div>
            </button>
            <button onClick={() => setMode('join')} className="onboarding-choice-btn">
              <div className="onboarding-choice-title">Join an existing church</div>
              <div className="onboarding-choice-desc">Enter an invite code from your church admin</div>
            </button>
            {alreadyMember && (
              <button type="button" onClick={() => router.push('/dashboard')} className="onboarding-choice-btn onboarding-choice-btn--quiet">
                <div className="onboarding-choice-title">Back to your dashboard</div>
                <div className="onboarding-choice-desc">Carry on in the church you were using</div>
              </button>
            )}
            {showBrowse && (
              <a href="/browse" className="onboarding-choice-btn onboarding-choice-btn--quiet">
                <div className="onboarding-choice-title">Back to the song library</div>
                <div className="onboarding-choice-desc">Keep browsing songs and your favourites without setting up a church</div>
              </a>
            )}
          </div>
        )}

        {ready && mode === 'create' && (
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

        {ready && mode === 'join' && isLoaded && !isSignedIn && (
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

        {ready && mode === 'join' && isLoaded && isSignedIn && (
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
