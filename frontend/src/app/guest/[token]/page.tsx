'use client'

// Guest musician invite link: /guest/<token> (see claude/guest-mode.md).
// Shows what the invite is for, gets the person signed in (or signed up), then — only when they press the
// button — joins them to the church as a guest and opens the plan. A button rather than automatic, so an admin
// checking a link while signed in as themselves doesn't use it up by accident.
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import { format, parseISO } from 'date-fns'
import { useAuth, useClerk, useUser } from '@clerk/nextjs'
import { rememberChurchId } from '@/lib/activeChurch'

const API = process.env.NEXT_PUBLIC_API_URL

interface Invite {
  church_name: string
  church_logo_url: string | null
  plan_title: string | null
  plan_date: string
  name: string
  role: string
  claimed: boolean
  expired: boolean
}

export default function GuestInvitePage() {
  const { token } = useParams<{ token: string }>()
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user } = useUser()
  const { signOut } = useClerk()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [loadError, setLoadError] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  useEffect(() => {
    axios.get(`${API}/api/guest/${encodeURIComponent(token)}`)
      .then(r => setInvite(r.data))
      .catch(err => setLoadError(err?.response?.data?.error || 'Couldn’t load this invite. Please check your connection and try again.'))
  }, [token])

  const here = `/guest/${token}`
  const join = async () => {
    setJoining(true)
    setJoinError('')
    try {
      const authToken = await getToken()
      const { data } = await axios.post(`${API}/api/guest/${encodeURIComponent(token)}/claim`, {}, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      rememberChurchId(data.church_id)
      // Full page load so the app starts fresh in the right church.
      window.location.assign(`/plans/${data.plan_id}`)
    } catch (err: any) {
      setJoinError(err?.response?.data?.error || 'Something went wrong. Please try again.')
      setJoining(false)
    }
  }

  let when = ''
  try { if (invite) when = format(parseISO(invite.plan_date), 'EEEE d MMMM yyyy') } catch {}
  const email = user?.primaryEmailAddress?.emailAddress

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-md)' }}>
      <div className="card" style={{ maxWidth: 460, width: '100%', textAlign: 'center' }}>
        {invite?.church_logo_url
          ? <img src={invite.church_logo_url} alt={invite.church_name} style={{ maxHeight: 64, maxWidth: 220, margin: '0 auto var(--space-md)' }} />
          : <img src="/logo.svg" alt="SongStack" style={{ height: 32, margin: '0 auto var(--space-md)' }} />}

        {loadError && <p className="text-muted">{loadError}</p>}
        {!invite && !loadError && <p className="text-muted">Loading…</p>}

        {invite && (
          <>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
              Hi {invite.name.split(/\s+/)[0]}!
            </h1>
            <p style={{ marginBottom: 'var(--space-md)' }}>
              You&apos;ve been invited to play ({invite.role}) at <strong>{invite.church_name}</strong>
              {when && <> on <strong>{when}</strong></>}{invite.plan_title && <> — {invite.plan_title}</>}.
              SongStack shows you the running order and the music.
            </p>

            {invite.expired ? (
              <p className="text-muted">This invite has expired. Ask whoever sent it for a new link.</p>
            ) : invite.claimed ? (
              <>
                <p className="text-muted" style={{ marginBottom: 'var(--space-md)' }}>
                  This invite has already been used. If that was you, sign in to see your plans.
                </p>
                <a className="btn btn-primary" href="/dashboard">Go to my plans</a>
              </>
            ) : !isLoaded ? (
              <p className="text-muted">Loading…</p>
            ) : isSignedIn ? (
              <>
                {joinError && <p className="error-text" style={{ marginBottom: 'var(--space-sm)' }}>{joinError}</p>}
                <button className="btn btn-primary" onClick={join} disabled={joining} style={{ width: '100%' }}>
                  {joining ? 'Joining…' : 'Open the plan'}
                </button>
                <p className="text-muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-sm)' }}>
                  Signed in as {email || 'you'}.{' '}
                  <button className="btn-inline-link" onClick={() => signOut({ redirectUrl: here })}>Not you?</button>
                </p>
              </>
            ) : (
              <>
                <a className="btn btn-primary" href={`/sign-up?redirect_url=${encodeURIComponent(here)}`} style={{ width: '100%', marginBottom: 'var(--space-sm)' }}>
                  Create a free account
                </a>
                <a className="btn btn-secondary" href={`/sign-in?redirect_url=${encodeURIComponent(here)}`} style={{ width: '100%' }}>
                  I already have an account — sign in
                </a>
                <p className="text-muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-md)' }}>
                  You&apos;ll only see the plans you&apos;re playing in. You can also use the SongStack iPad app with the same account.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
