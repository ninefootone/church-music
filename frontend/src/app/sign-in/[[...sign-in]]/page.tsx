import { SignIn } from '@clerk/nextjs'
import { Music } from 'lucide-react'

export default function SignInPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24, padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>
          <Music size={22} style={{ color: 'var(--color-brand-500)' }} /> Song Stack
        </div>
        <div style={{ fontSize: 15, color: 'var(--color-text-muted)' }}>
          Song library and service planning for churches
        </div>
      </div>
      <SignIn />
    </div>
  )
}
