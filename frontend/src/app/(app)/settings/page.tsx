'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useChurch } from '@/context/ChurchContext'
import api, { setAuthToken } from '@/lib/api'
import { Settings, Copy, Check, RefreshCw, Plus, X } from 'lucide-react'

interface RoleItem {
  id?: string
  name: string
  originalName?: string
}

interface WarningModal {
  type: 'delete' | 'rename'
  role: RoleItem
  index: number
  count: number
  newName?: string
}

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
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')

  // Roles
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [rolesLoaded, setRolesLoaded] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [rolesSaving, setRolesSaving] = useState(false)
  const [rolesSaved, setRolesSaved] = useState(false)
  const [rolesError, setRolesError] = useState('')
  const [warningModal, setWarningModal] = useState<WarningModal | null>(null)
  const dragIndex = useRef<number | null>(null)

  useEffect(() => {
    if (church) {
      setChurchName(church.name)
      setCcliNumber(church.ccli_number || '')
      if (!rolesLoaded) {
        api.get(`/api/churches/${church.id}/roles`).then(r => {
          setRoles(r.data.map((role: { id: string; name: string }) => ({ id: role.id, name: role.name, originalName: role.name })))
          setRolesLoaded(true)
        }).catch(() => {})
      }
    }
  }, [church, rolesLoaded])

  useEffect(() => {
    const email = user?.primaryEmailAddress?.emailAddress
    if (!email) return
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/mailing/status?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => setSubscribed(d.subscribed))
      .catch(() => {})
  }, [user])

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
      const { data } = await client.post('/api/stripe/create-checkout-session', { priceId, churchId: church.id })
      window.location.href = data.url
    } catch {
      alert('Something went wrong. Please try again.')
    }
  }

  async function handleManageBilling() {
    if (!church) return
    try {
      const client = await getAuthenticatedApi()
      const { data } = await client.post('/api/stripe/create-portal-session', { churchId: church.id })
      window.location.href = data.url
    } catch {
      alert('Something went wrong. Please try again.')
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !church) return
    setLogoUploading(true)
    setLogoError('')
    try {
      const client = await getAuthenticatedApi()
      const formData = new FormData()
      formData.append('logo', file)
      await client.post(`/api/churches/${church.id}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await refetch()
    } catch (err: any) {
      setLogoError(err.response?.data?.error || 'Upload failed.')
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  async function handleMailingToggle() {
    const email = user?.primaryEmailAddress?.emailAddress
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
    if (!email) return
    setMailingLoading(true)
    try {
      if (subscribed) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/mailing/unsubscribe`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        setSubscribed(false)
      } else {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/mailing/subscribe`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  // Roles
  function handleAddRole() {
    const trimmed = newRoleName.trim()
    if (!trimmed) return
    if (roles.some(r => r.name.toLowerCase() === trimmed.toLowerCase())) return
    setRoles(prev => [...prev, { name: trimmed }])
    setNewRoleName('')
  }

  async function handleDeleteRole(index: number) {
    const role = roles[index]
    if (role.id && role.originalName) {
      try {
        const client = await getAuthenticatedApi()
        const { data } = await client.get(`/api/churches/${church!.id}/roles/usage?name=${encodeURIComponent(role.originalName)}`)
        if (data.count > 0) {
          setWarningModal({ type: 'delete', role, index, count: data.count })
          return
        }
      } catch { /* proceed */ }
    }
    setRoles(prev => prev.filter((_, i) => i !== index))
  }

  function confirmDelete(index: number) {
    setRoles(prev => prev.filter((_, i) => i !== index))
    setWarningModal(null)
  }

  async function handleSaveRoles() {
    setRolesSaving(true)
    setRolesError('')
    setRolesSaved(false)
    try {
      const client = await getAuthenticatedApi()
      const { data } = await client.put(`/api/churches/${church!.id}/roles`, {
        roles: roles.map((r, i) => ({ id: r.id, name: r.name.trim(), sort_order: i }))
      })
      setRoles(data.map((role: { id: string; name: string }) => ({ id: role.id, name: role.name, originalName: role.name })))
      setRolesSaved(true)
      setTimeout(() => setRolesSaved(false), 3000)
    } catch {
      setRolesError('Failed to save roles.')
    } finally {
      setRolesSaving(false)
    }
  }

  // Drag and drop
  function handleDragStart(index: number) {
    dragIndex.current = index
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (dragIndex.current === null || dragIndex.current === index) return
    setRoles(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex.current!, 1)
      next.splice(index, 0, moved)
      dragIndex.current = index
      return next
    })
  }

  function handleDragEnd() {
    dragIndex.current = null
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
      <form onSubmit={handleSave}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 20 }}>Church details</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 16 }}>
            <div>
              <label style={labelStyle}>Church name</label>
              <input style={inputStyle} value={churchName} onChange={e => setChurchName(e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>
                CCLI Licence Number <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <input style={inputStyle} placeholder="e.g. 123456" value={ccliNumber} onChange={e => setCcliNumber(e.target.value)} />
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
                Used in usage reports. Don't have one?{' '}
                <a href="https://uk.ccli.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-brand-500)' }}>Get licensed at ccli.com</a>
              </p>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <label style={labelStyle}>Church logo <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {church?.logo_url && (
                <img src={church.logo_url} alt="Church logo" style={{ height: 48, maxWidth: 160, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--color-border)', padding: 4, background: 'var(--color-bg)' }} />
              )}
              <div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  style={{ display: 'none' }}
                  id="logo-upload"
                  onChange={handleLogoUpload}
                />
                <label htmlFor="logo-upload" className="btn btn-ghost" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {logoUploading ? 'Uploading…' : church?.logo_url ? 'Replace logo' : 'Upload logo'}
                </label>
                {logoError && <p style={{ fontSize: 12, color: 'var(--color-error, #d9534f)', marginTop: 6 }}>{logoError}</p>}
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>PNG, JPG, SVG or WebP. Max 2MB. Wide/horizontal logos work best — tall or square images will be cropped to fit the nav bar.</p>
              </div>
            </div>
          </div>

        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : saved ? <><Check size={15} style={{ marginRight: 6 }} />Saved</> : 'Save changes'}
          </button>
        </div>
      </form>

      {/* Musician roles */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>Musician roles</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Customise the roles shown when adding a musician to a plan. Drag to reorder. If none are set, a default list is used.
        </p>

        {rolesError && (
          <div style={{ background: '#fdf0f0', border: '1px solid #f5c0c0', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#9a3a3a' }}>
            {rolesError}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, minHeight: 36 }}>
          {roles.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>No custom roles yet — defaults will be used.</p>
          )}
          {roles.map((role, i) => (
            <div
              key={role.id || role.name}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={e => handleDragOver(e, i)}
              onDragEnd={handleDragEnd}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 10px 5px 12px',
                background: 'var(--color-neutral-50)',
                border: '1px solid var(--color-border)',
                borderRadius: 999,
                fontSize: 13, fontWeight: 500,
                color: 'var(--color-text-primary)',
                cursor: 'grab', userSelect: 'none',
              }}
            >
              {role.name}
              <button
                type="button"
                onClick={() => handleDeleteRole(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0, display: 'flex', alignItems: 'center', lineHeight: 1 }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            placeholder="New role, e.g. Violin"
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRole() } }}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 14, color: 'var(--color-text-primary)', background: 'var(--color-surface)', fontFamily: 'inherit' }}
          />
          <button type="button" onClick={handleAddRole} className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15} />Add
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={handleSaveRoles} className="btn btn-primary" disabled={rolesSaving}>
            {rolesSaving ? 'Saving…' : rolesSaved ? <><Check size={15} style={{ marginRight: 6 }} />Saved</> : 'Save roles'}
          </button>
        </div>
      </div>

      {/* Settings grid — billing, invite, mailing */}
      <div className="settings-grid">

        {/* Billing */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>Billing</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>Manage your Song Stack subscription.</p>
          {(!church?.subscription_status || church?.subscription_status === 'free' || church?.subscription_status === 'canceled') ? (
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
                Status: <strong style={{ textTransform: 'capitalize' }}>{String(church?.subscription_status) === 'canceled' ? 'Cancelled' : (church?.subscription_status ?? '')}</strong>
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
        <div className="settings-grid-mailing" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 24 }}>
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
                <button onClick={handleMailingToggle} disabled={mailingLoading} className="btn btn-ghost" style={{ padding: '4px 0', fontSize: 13 }}>
                  {mailingLoading ? 'Updating…' : subscribed ? 'Unsubscribe' : 'Subscribe'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Warning modal */}
      {warningModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setWarningModal(null) }}
        >
          <div style={{ background: 'var(--color-surface)', borderRadius: 14, padding: 24, maxWidth: 400, width: '100%' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 }}>
              {warningModal.type === 'delete' ? 'Delete role?' : 'Rename role?'}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
              {warningModal.type === 'delete'
                ? `"${warningModal.role.originalName}" is currently assigned to ${warningModal.count} musician${warningModal.count !== 1 ? 's' : ''} in your plans. Deleting it won't remove those existing assignments, but it will no longer appear in the role picker.`
                : `"${warningModal.role.originalName}" is currently assigned to ${warningModal.count} musician${warningModal.count !== 1 ? 's' : ''} in your plans. Renaming it here won't update those existing assignments.`
              }
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setWarningModal(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'var(--color-error, #d9534f)', borderColor: 'var(--color-error, #d9534f)' }}
                onClick={() => confirmDelete(warningModal.index)}
              >
                {warningModal.type === 'delete' ? 'Delete anyway' : 'Rename anyway'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}