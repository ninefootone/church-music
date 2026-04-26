import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HomePage() {
  // If already signed in, go straight to dashboard
  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-nav-brand">
          <img src="/logo.svg" alt="Song Stack" className="landing-nav-logo" />
        </div>
        <div className="landing-nav-actions">
          <Link href="/sign-in" className="landing-nav-link">Sign in</Link>
          <Link href="/sign-up" className="btn btn-primary">Get started</Link>
        </div>
      </nav>

      <main className="landing-hero">
        <div className="landing-hero-inner">
          <img src="/logo-strap.svg" alt="Song Stack" className="landing-hero-logo" />
          <h1 className="sr-only">
            Your church&apos;s song library
          </h1>
          <p className="landing-hero-text">
            Manage your worship songs, plan services, and share chord charts &ndash; all in one place, for your whole team.
          </p>
          <div className="landing-hero-actions">
            <Link href="/sign-up" className="btn btn-primary landing-cta-btn">Get started free</Link>
            <Link href="/sign-in" className="btn btn-secondary landing-cta-btn">Sign in</Link>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        Song Stack &copy; 2026
      </footer>
    </div>
  )
}
