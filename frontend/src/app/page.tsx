import Link from 'next/link'
import { Music } from 'lucide-react'

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '0 var(--space-lg)', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          <Music size={20} style={{ color: 'var(--color-brand-500)' }} /> Song Stack
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/sign-in" style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-secondary)', textDecoration: 'none', padding: '6px 12px' }}>Sign in</Link>
          <Link href="/sign-up" className="btn btn-primary">Get started</Link>
        </div>
      </nav>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ maxWidth: 640 }}>
          <h1 style={{ fontSize: 52, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 20 }}>
            Your church&apos;s<br />song library
          </h1>
          <p style={{ fontSize: 20, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 36 }}>
            Manage your worship songs, plan services, and share chord charts — all in one place, for your whole team.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link href="/sign-up" className="btn btn-primary" style={{ padding: '11px 28px', fontSize: 16 }}>Get started free</Link>
            <Link href="/sign-in" className="btn btn-secondary" style={{ padding: '11px 28px', fontSize: 16 }}>Sign in</Link>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        Song Stack · <Link href="/sign-in" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Sign in</Link>
      </footer>
    </div>
  )
}
