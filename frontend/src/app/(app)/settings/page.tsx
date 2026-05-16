'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { useChurch } from '@/context/ChurchContext'
import api, { setAuthToken } from '@/lib/api'
import { Copy, Check, RefreshCw, Plus, X } from 'lucide-react'

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

interface ItemType {
  id?: string
  name: string
}

export default function SettingsPage() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { church, isAdmin, refetch } = useChurch()

  const isMasterLibrary = church?.id === process.env.NEXT_PUBLIC_MASTER_CHURCH_ID

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

  // Global tags (master library only)
  const [globalTags, setGlobalTags] = useState<{ id: string; name: string }[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [tagsSaving, setTagsSaving] = useState(false)
  const [tagsError, setTagsError] = useState('')

  // Roles
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [rolesLoaded, setRolesLoaded] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [rolesSaving, setRolesSaving] = useState(false)
  const [rolesSaved, setRolesSaved] = useState(false)
  const [rolesError, setRolesError] = useState('')
  const [warningModal, setWarningModal] = useState<WarningModal | null>(null)
  const dragIndex = useRef<number | null>(null)

  // Plan item types
  const [itemTypes, setItemTypes] = useState<ItemType[]>([])
  const [itemTypesLoaded, setItemTypesLoaded] = useState(false)
  const [newItemTypeName, setNewItemTypeName] = useState('')
  const [itemTypesSaving, setItemTypesSaving] = useState(false)
  const [itemTypesSaved, setItemTypesSaved] = useState(false)
  const [itemTypesError, setItemTypesError] = useState('')
  const itemTypeDragIndex = useRef<number | null>(null)

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
      if (!itemTypesLoaded) {
        api.get(`/api/churches/${church.id}/plan-item-types`).then(r => {
          setItemTypes(r.data.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })))
          setItemTypesLoaded(true)
        }).catch(() => {})
      }
      if (church.id === process.env.NEXT_PUBLIC_MASTER_CHURCH_ID) {
        api.get('/api/songs/tags/all').then(r => setGlobalTags(r.data)).catch(() => {})
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

  // Drag and drop (roles)
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

  // Plan item types handlers
  function handleAddItemType() {
    const trimmed = newItemTypeName.trim()
    if (!trimmed) return
    if (itemTypes.some(t => t.name.toLowerCase() === trimmed.toLowerCase())) return
    setItemTypes(prev => [...prev, { name: trimmed }])
    setNewItemTypeName('')
  }

  function handleDeleteItemType(index: number) {
    setItemTypes(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSaveItemTypes() {
    setItemTypesSaving(true)
    setItemTypesError('')
    setItemTypesSaved(false)
    try {
      const client = await getAuthenticatedApi()
      const { data } = await client.put(`/api/churches/${church!.id}/plan-item-types`, {
        types: itemTypes.map((t, i) => ({ id: t.id, name: t.name.trim(), sort_order: i }))
      })
      setItemTypes(data.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })))
      setItemTypesSaved(true)
      setTimeout(() => setItemTypesSaved(false), 3000)
    } catch {
      setItemTypesError('Failed to save plan item types.')
    } finally {
      setItemTypesSaving(false)
    }
  }

  // Drag and drop (plan item types)
  function handleItemTypeDragStart(index: number) {
    itemTypeDragIndex.current = index
  }

  function handleItemTypeDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (itemTypeDragIndex.current === null || itemTypeDragIndex.current === index) return
    setItemTypes(prev => {
      const next = [...prev]
      const [moved] = next.splice(itemTypeDragIndex.current!, 1)
      next.splice(index, 0, moved)
      itemTypeDragIndex.current = index
      return next
    })
  }

  function handleItemTypeDragEnd() {
    itemTypeDragIndex.current = null
  }

  async function handleAddTag() {
    const trimmed = newTagName.trim()
    if (!trimmed) return
    if (globalTags.some(t => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setTagsError('That tag already exists.')
      return
    }
    setTagsSaving(true)
    setTagsError('')
    try {
      const client = await getAuthenticatedApi()
      const { data } = await client.post('/api/songs/tags', { name: trimmed })
      setGlobalTags(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewTagName('')
    } catch (err: any) {
      setTagsError(err.response?.data?.error || 'Failed to add tag.')
    } finally {
      setTagsSaving(false)
    }
  }

  async function handleDeleteTag(id: string) {
    setTagsError('')
    try {
      const client = await getAuthenticatedApi()
      await client.delete(`/api/songs/tags/${id}`)
      setGlobalTags(prev => prev.filter(t => t.id !== id))
    } catch (err: any) {
      setTagsError(err.response?.data?.error || 'Failed to delete tag.')
    }
  }

  if (!isAdmin) {
    return (
      <div className="settings-restricted">
        <p className="settings-restricted-text">Only admins can access settings.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="settings-page-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">Manage your church details</p>
      </div>

      {error && (
        <div className="settings-error">
          {error}
        </div>
      )}

      {/* Church details */}
      <form onSubmit={handleSave}>
        <div className="settings-card settings-card--spaced">
          <h2 className="settings-section-heading">Church details</h2>
          <div className="settings-form-grid">
            <div>
              <label className="settings-label">Church name</label>
              <input className="settings-input" value={churchName} onChange={e => setChurchName(e.target.value)} required />
            </div>
            <div>
              <label className="settings-label">
                CCLI Licence Number <span className="label-note">(optional)</span>
              </label>
              <input className="settings-input" placeholder="e.g. 123456" value={ccliNumber} onChange={e => setCcliNumber(e.target.value)} />
              <p className="settings-hint">
                Used in usage reports. Don't have one?{' '}
                <a href="https://uk.ccli.com" target="_blank" rel="noopener noreferrer" className="link">Get licensed at ccli.com</a>
              </p>
            </div>
          </div>

          <div className="settings-logo-section">
            <label className="settings-label">Church logo <span className="label-note">(optional)</span></label>
            <div className="settings-logo-row">
              {church?.logo_url && (
                <img src={church.logo_url} alt="Church logo" className="settings-logo-preview" />
              )}
              <div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="visually-hidden-input"
                  id="logo-upload"
                  onChange={handleLogoUpload}
                />
                <label htmlFor="logo-upload" className="btn btn-ghost btn-upload-label">
                  {logoUploading ? 'Uploading…' : church?.logo_url ? 'Replace logo' : 'Upload logo'}
                </label>
                {logoError && <p className="settings-hint settings-hint--error">{logoError}</p>}
                <p className="settings-hint">PNG, JPG, SVG or WebP. Max 2MB. Wide/horizontal logos work best — tall or square images will be cropped to fit the nav bar.</p>
              </div>
            </div>
          </div>

          <div className="settings-save-row">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : saved ? <><Check size={15} className="icon-mr" />Saved</> : 'Save changes'}
            </button>
          </div>
        </div>
      </form>

      {/* Settings grid — billing, invite, mailing */}
      <div className="settings-grid">

        {/* Billing */}
        <div className="settings-card">
          <h2 className="settings-section-heading settings-section-heading--tight">Billing</h2>
          <p className="settings-section-desc">Manage your Song Stack subscription.</p>
          {(!church?.subscription_status || church?.subscription_status === 'free' || church?.subscription_status === 'canceled') ? (
            <div>
              <p className="settings-body-text settings-body-text--spaced">You're on the <strong>free plan</strong> — limited to 5 songs and 1 plan.</p>
              <div className="btn-group">
                <button onClick={() => handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!)} className="btn btn-ghost">£5 / month</button>
                <button onClick={() => handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL!)} className="btn btn-primary">£50 / year</button>
              </div>
            </div>
          ) : (
            <div>
              <p className="settings-body-text settings-body-text--spaced">
                Status: <strong style={{ textTransform: 'capitalize' }}>{String(church?.subscription_status) === 'canceled' ? 'Cancelled' : (church?.subscription_status ?? '')}</strong>
              </p>
              <button onClick={handleManageBilling} className="btn btn-ghost">Manage subscription →</button>
            </div>
          )}
        </div>

        {/* Invite code */}
        <div className="settings-card">
          <h2 className="settings-section-heading settings-section-heading--tight">Invite code</h2>
          <p className="settings-section-desc">Share this code with people you want to join your church.</p>
          <div className="invite-col">
            <div className="invite-code-display">
              {church?.invite_code}
            </div>
            <div className="btn-group">
              <button type="button" className="btn btn-ghost btn-icon-label" onClick={handleCopy}>
                {copied ? <><Check size={15} />Copied</> : <><Copy size={15} />Copy</>}
              </button>
              <button type="button" className="btn btn-ghost btn-icon-label" onClick={handleRegenerateInvite} disabled={regenerating}>
                <RefreshCw size={15} />{regenerating ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>
          </div>
        </div>

        {/* Mailing preferences */}
        <div className="settings-grid-mailing settings-card">
          <h2 className="settings-section-heading settings-section-heading--tight">Email updates</h2>
          <p className="settings-section-desc">Occasional news and updates about Song Stack. No spam, unsubscribe any time.</p>
          {subscribed === null ? (
            <p className="settings-subtitle">Loading…</p>
          ) : (
            <div className="mailing-col">
              <p className="settings-body-text">
                {subscribed ? 'You\'re subscribed to Song Stack updates.' : 'You\'re not currently subscribed.'}
              </p>
              <div>
                <button onClick={handleMailingToggle} disabled={mailingLoading} className="btn btn-ghost btn-link-inline">
                  {mailingLoading ? 'Updating…' : subscribed ? 'Unsubscribe' : 'Subscribe'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Musician roles */}
      <div className="settings-card settings-card--spaced">
        <h2 className="settings-section-heading settings-section-heading--tight">Musician roles</h2>
        <p className="settings-section-desc">
          Customise the roles shown when adding a musician to a plan. Drag to reorder. If none are set, a default list is used.
        </p>

        {rolesError && (
          <div className="settings-error">
            {rolesError}
          </div>
        )}

        <div className="role-chip-list">
          {roles.length === 0 && (
            <p className="form-empty-note">No custom roles yet — defaults will be used.</p>
          )}
          {roles.map((role, i) => (
            <div
              key={role.id || role.name}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={e => handleDragOver(e, i)}
              onDragEnd={handleDragEnd}
              className="role-chip"
            >
              {role.name}
              <button
                type="button"
                onClick={() => handleDeleteRole(i)}
                className="btn-icon-remove"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="role-add-row">
          <input
            type="text"
            placeholder="New role, e.g. Violin"
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRole() } }}
            className="role-input"
          />
          <button type="button" onClick={handleAddRole} className="btn btn-ghost btn-icon-label">
            <Plus size={15} />Add
          </button>
        </div>

        <div className="settings-footer-row">
          <button type="button" onClick={handleSaveRoles} className="btn btn-primary" disabled={rolesSaving}>
            {rolesSaving ? 'Saving…' : rolesSaved ? <><Check size={15} className="icon-mr" />Saved</> : 'Save roles'}
          </button>
        </div>
      </div>

      {/* Plan item types */}
      <div className="settings-card settings-card--spaced">
        <h2 className="settings-section-heading settings-section-heading--tight">Plan item types</h2>
        <p className="settings-section-desc">
          Customise the item types shown when building a plan. Drag to reorder. If none are set, a default list is used. An &ldquo;Other&rdquo; option is always available.
        </p>

        {itemTypesError && (
          <div className="settings-error">
            {itemTypesError}
          </div>
        )}

        <div className="role-chip-list">
          {itemTypes.length === 0 && (
            <p className="form-empty-note">No custom item types yet — defaults will be used.</p>
          )}
          {itemTypes.map((t, i) => (
            <div
              key={t.id || t.name}
              draggable
              onDragStart={() => handleItemTypeDragStart(i)}
              onDragOver={e => handleItemTypeDragOver(e, i)}
              onDragEnd={handleItemTypeDragEnd}
              className="role-chip"
            >
              {t.name}
              <button
                type="button"
                onClick={() => handleDeleteItemType(i)}
                className="btn-icon-remove"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="role-add-row">
          <input
            type="text"
            placeholder="New item type, e.g. Offering"
            value={newItemTypeName}
            onChange={e => setNewItemTypeName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddItemType() } }}
            className="role-input"
          />
          <button type="button" onClick={handleAddItemType} className="btn btn-ghost btn-icon-label">
            <Plus size={15} />Add
          </button>
        </div>

        <div className="settings-footer-row">
          <button type="button" onClick={handleSaveItemTypes} className="btn btn-primary" disabled={itemTypesSaving}>
            {itemTypesSaving ? 'Saving…' : itemTypesSaved ? <><Check size={15} className="icon-mr" />Saved</> : 'Save item types'}
          </button>
        </div>
      </div>

      {/* Global tag management — master library only */}
      {isMasterLibrary && (
        <div className="settings-card settings-card--spaced">
          <h2 className="settings-section-heading settings-section-heading--tight">Song tags</h2>
          <p className="settings-section-desc">
            Manage the approved tag vocabulary available to all churches. All churches pick from this list — none can create their own.
          </p>

          {tagsError && <div className="settings-error">{tagsError}</div>}

          <div className="role-chip-list">
            {globalTags.length === 0 && (
              <p className="form-empty-note">No tags yet.</p>
            )}
            {globalTags.map(tag => (
              <div key={tag.id} className="role-chip">
                {tag.name}
                <button
                  type="button"
                  onClick={() => handleDeleteTag(tag.id)}
                  className="btn-icon-remove"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="role-add-row">
            <input
              type="text"
              placeholder="e.g. God's Faithfulness"
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
              className="role-input"
            />
            <button type="button" onClick={handleAddTag} disabled={tagsSaving} className="btn btn-ghost btn-icon-label">
              <Plus size={15} />{tagsSaving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Warning modal */}
      {warningModal && (
        <div
          className="modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) setWarningModal(null) }}
        >
          <div className="warning-modal-box">
            <h3 className="modal-title">
              {warningModal.type === 'delete' ? 'Delete role?' : 'Rename role?'}
            </h3>
            <p className="modal-body">
              {warningModal.type === 'delete'
                ? `"${warningModal.role.originalName}" is currently assigned to ${warningModal.count} musician${warningModal.count !== 1 ? 's' : ''} in your plans. Deleting it won't remove those existing assignments, but it will no longer appear in the role picker.`
                : `"${warningModal.role.originalName}" is currently assigned to ${warningModal.count} musician${warningModal.count !== 1 ? 's' : ''} in your plans. Renaming it here won't update those existing assignments.`
              }
            </p>
            <div className="modal-footer">
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