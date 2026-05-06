'use client'

import { useState, useEffect } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useChurch } from '@/context/ChurchContext'
import api, { setAuthToken } from '@/lib/api'
import { Settings, Copy, Check, RefreshCw } from 'lucide-react'

export default function SettingsPage() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { church, isAdmin, refetch } = useChurch()

  const [churchName, setChurchName] = useState('')
  const [ccliNumber, setCcliNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [mailingLoading, setMailingLoading] = useState(false)

  useEffect(() => {
    if (church) {
      setChurchName(church.name)
      setCcliNumber(church.ccli_number || '')
    }
  }, [church])

  useEffect(() => {
    const email = user?.primaryEmailAddress?.emailAddress
    if (!email) return
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/mailing/status?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => setSubscribed(d.subscribed))
      .catch(() => {})
  }, [user])

  async function handleMailingToggle() {
    const email = user?.primaryEmailAddress?.emailAddress
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
    if (!email) return
    setMailingLoading(true)
    try {
      if (subscribed) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/mailing/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        setSubscribed(false)
      } else {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/mailing/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name }),
        })
        setSubscribed(true)
      }
    } catch {
      setError('Failed to update mailing preference.')
    } finally {
      setMailingLoading(false)
    }
  }

  async function getAuthenticatedApi() {
    const token = await getToken()
    setAuthToken(token)
    return api
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const client = await getAuthenticatedApi()
      await client.patch(`/api/churches/${church!.id}`, {
        name: churchName,
        ccli_number: ccliNumber || null,
      })
      await refetch()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRegenerateInvite() {
    if (!confirm('Are you sure? The old invite code will stop working immediately.')) return
    setRegenerating(true)
    try {
      const client = await getAuthenticatedApi()
      await client.post(`/api/churches/${church!.id}/regenerate-invite`)
      await refetch()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to regenerate invite code.')
    } finally {
      setRegenerating(false)
    }
  }

  function handleCopy() {
    if (!church) return
    navigator.clipboard.writeText(church.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleUpgrade(priceId: string) {
    if (!church) return
    try {
      const client = await getAuthenticatedApi()
      const { data } = await client.post('/api/stripe/create-checkout-session', {
        priceId,
        churchId: church.id,
      })
      window.location.href = data.url
    } catch (err) {
      alert('Something went wrong. Please try again.')
    }
  }

  async function handleManageBilling() {
    if (!church) return
    try {
      const client = await getAuthenticatedApi()
      const { data } = await client.post('/api/stripe/create-portal-session', {
        churchId: church.id,
      })
      window.location.href = data.url
    } catch (err) {
      alert('Something went wrong. Please try again.')
    }
  }

  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: '10px', fontFamily: 'inherit', fontSize: 15, color: 'var(--color-text-primary)', background: 'var(--color-surface)', outline: 'none', boxSizing: 'border-box' as const }

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>Only admins can access settings.</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <div style={{ width: 40, height: 40, background: 'var(--color-brand-500)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Settings size={20} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>Settings</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Manage your church details</p>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fdf0f0', border: '1px solid #f5c0c0', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#9a3a3a' }}>
          {error}
        </div>
      )}

      {/* Church details */}
      {/* Church details — full width */}
      <form onSubmit={handleSave}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 20 }}>Church details</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div>
              <label style={labelStyle}>Church name</label>
              <input
                style={inputStyle}
                value={churchName}
                onChange={e => setChurchName(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>
                CCLI Licence Number <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <input
                style={inputStyle}
                placeholder="e.g. 123456"
                value={ccliNumber}
                onChange={e => setCcliNumber(e.target.value)}
              />
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
                Used in usage reports. Don't have one?{' '}
                <a href="https://uk.ccli.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-brand-500)' }}>
                  Get licensed at ccli.com
                </a>
              </p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : saved ? <><Check size={15} style={{ marginRight: 6 }} />Saved</> : 'Save changes'}
          </button>
        </div>
      </form>

      {/* Two column grid — billing + invite code */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>

        {/* Billing */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>Billing</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>Manage your Song Stack subscription.</p>
          {(!church?.subscription_status || church?.subscription_status === 'free') ? (
            <div>
              <p style={{ fontSize: 14, color: 'var(--color-text-primary)', marginBottom: 16 }}>You're on the <strong>free plan</strong> — limited to 5 songs and 1 plan.</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!)} className="btn btn-ghost">£5 / month</button>
                <button onClick={() => handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL!)} className="btn btn-primary">£50 / year</button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 14, color: 'var(--color-text-primary)', marginBottom: 16 }}>
                Status: <strong style={{ textTransform: 'capitalize' }}>{church?.subscription_status}</strong>
              </p>
              <button onClick={handleManageBilling} className="btn btn-ghost">Manage subscription →</button>
            </div>
          )}
        </div>

        {/* Invite code */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>Invite code</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>Share this code with people you want to join your church.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: '10px 14px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-text-primary)' }}>
              {church?.invite_code}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {copied ? <><Check size={15} />Copied</> : <><Copy size={15} />Copy</>}
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleRegenerateInvite} disabled={regenerating} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={15} />{regenerating ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>
          </div>
        </div>

      {/* Mailing preferences */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 24, gridColumn: 'span 2' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>Email updates</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>Occasional news and updates about Song Stack. No spam, unsubscribe any time.</p>
          {subscribed === null ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Loading…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 14, color: 'var(--color-text-primary)', margin: 0 }}>
                {subscribed ? 'You\'re subscribed to Song Stack updates.' : 'You\'re not currently subscribed.'}
              </p>
              <div>
                <button
                  onClick={handleMailingToggle}
                  disabled={mailingLoading}
                  className="btn btn-ghost"
                  style={{ padding: '4px 0', fontSize: 13 }}
                >
                  {mailingLoading ? 'Updating…' : subscribed ? 'Unsubscribe' : 'Subscribe'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}