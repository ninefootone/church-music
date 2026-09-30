'use client'

import { useState } from 'react'
import { useClerk } from '@clerk/nextjs'
import api from '@/lib/api'

// Delete-account section for the web Account page. Uses the same backend endpoints as the iPad app:
//   GET /api/account/deletion-check -> { blockers[{message}], willDeleteChurches[] }
//   DELETE /api/account { confirm: 'DELETE' }
// Clerk's own "Delete account" button is switched OFF in the Clerk dashboard on purpose —
// deleting only in Clerk would leave the church data behind. Keep it off.
type Check = { blockers: { message: string }[]; willDeleteChurches: string[] }

export default function DeleteAccountSection() {
  const { signOut } = useClerk()
  const [step, setStep] = useState<'idle' | 'checking' | 'blocked' | 'confirm' | 'deleting'>('idle')
  const [check, setCheck] = useState<Check | null>(null)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')

  async function start() {
    setError('')
    setStep('checking')
    try {
      const res = await api.get('/api/account/deletion-check')
      setCheck(res.data)
      setStep(res.data.blockers?.length ? 'blocked' : 'confirm')
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not check your account. Please try again.')
      setStep('idle')
    }
  }

  async function doDelete() {
    setError('')
    setStep('deleting')
    try {
      await api.delete('/api/account', { data: { confirm: 'DELETE' } })
      try { await signOut() } catch { /* the Clerk user is already gone */ }
      window.location.href = '/'
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Something went wrong. Please try again.')
      setStep('confirm')
    }
  }

  const box: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, background: '#fff', width: '100%', maxWidth: 880 }
  const danger: React.CSSProperties = { background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }
  const plain: React.CSSProperties = { background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '0 16px 60px' }}>
      <div style={box}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Delete account</h2>
        <p style={{ margin: '0 0 16px', color: '#4b5563', fontSize: 14, lineHeight: 1.5 }}>
          Permanently deletes your Song Stack account and personal data. This can&apos;t be undone.
        </p>

        {step === 'idle' || step === 'checking' ? (
          <button style={danger} onClick={start} disabled={step === 'checking'}>
            {step === 'checking' ? 'Checking…' : 'Delete my account'}
          </button>
        ) : null}

        {step === 'blocked' && check && (
          <div>
            {check.blockers.map((b, i) => (
              <p key={i} style={{ margin: '0 0 12px', color: '#991b1b', fontSize: 14, lineHeight: 1.5 }}>{b.message}</p>
            ))}
            <button style={plain} onClick={() => setStep('idle')}>OK</button>
          </div>
        )}

        {(step === 'confirm' || step === 'deleting') && check && (
          <div>
            {check.willDeleteChurches.length > 0 && (
              <p style={{ margin: '0 0 12px', color: '#991b1b', fontSize: 14, lineHeight: 1.5 }}>
                You&apos;re the last member of {check.willDeleteChurches.map(n => `“${n}”`).join(', ')}, so{' '}
                {check.willDeleteChurches.length > 1 ? 'those churches' : 'that church'} and all{' '}
                {check.willDeleteChurches.length > 1 ? 'their' : 'its'} songs, files and services will be deleted too.
              </p>
            )}
            <p style={{ margin: '0 0 8px', fontSize: 14 }}>Type <strong>DELETE</strong> to confirm:</p>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              disabled={step === 'deleting'}
              autoComplete="off"
              style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', marginRight: 10, fontSize: 14 }}
            />
            <button style={{ ...danger, opacity: typed === 'DELETE' && step !== 'deleting' ? 1 : 0.4 }}
              disabled={typed !== 'DELETE' || step === 'deleting'} onClick={doDelete}>
              {step === 'deleting' ? 'Deleting…' : 'Permanently delete'}
            </button>
            <button style={{ ...plain, marginLeft: 10 }} disabled={step === 'deleting'}
              onClick={() => { setTyped(''); setStep('idle') }}>Cancel</button>
          </div>
        )}

        {error && <p style={{ margin: '12px 0 0', color: '#991b1b', fontSize: 14 }}>{error}</p>}
      </div>
    </div>
  )
}
