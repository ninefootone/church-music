import Link from 'next/link'
import { Music } from 'lucide-react'

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          <Music size={18} style={{ color: 'var(--color-brand-500)' }} /> Church Music
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/sign-in" style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)', textDecoration: 'none', padding: '6px 12px' }}>Sign in</Link>
          <Link href="/sign-up" className="btn btn-primary" style={{ fontSize: 14 }}>Get started</Link>
        </div>
      </nav>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ maxWidth: 600 }}>
          <h1 style={{ fontSize: 48, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 20 }}>
            Your church's<br />song library
          </h1>
          <p style={{ fontSize: 18, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 36 }}>
            Manage your worship songs, plan services, and share chord charts — all in one place, for your whole team.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link href="/sign-up" className="btn btn-primary" style={{ fontSize: 15, padding: '10px 24px' }}>Get started free</Link>
            <Link href="/sign-in" className="btn btn-secondary" style={{ fontSize: 15, padding: '10px 24px' }}>Sign in</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
