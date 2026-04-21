import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HomePage() {
  // If already signed in, go straight to dashboard
  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '0 var(--space-lg)', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          <img src="/logo.svg" alt="Song Stack" style={{ height: 24, borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/sign-in" style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-secondary)', textDecoration: 'none', padding: '6px 12px' }}>Sign in</Link>
          <Link href="/sign-up" className="btn btn-primary">Get started</Link>
        </div>
      </nav>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ maxWidth: 640 }}>
          <img src="/logo-strap.svg" alt="Song Stack" style={{ height: 64, marginBottom: 32, display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
          <h1 style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
            Your church&apos;s song library
          </h1>
          <p style={{ fontSize: 20, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 36 }}>
            Manage your worship songs, plan services, and share chord charts &mdash; all in one place, for your whole team.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/sign-up" className="btn btn-primary" style={{ padding: '11px 28px', fontSize: 16 }}>Get started free</Link>
            <Link href="/sign-in" className="btn btn-secondary" style={{ padding: '11px 28px', fontSize: 16 }}>Sign in</Link>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        Song Stack &copy; 2026
      </footer>
    </div>
  )
}
