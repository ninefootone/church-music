import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CookieSettingsLink from '@/components/ui/CookieSettingsLink'

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
            Manage your worship songs, build plans, and share chord charts &ndash; all in one place, for your whole team.
          </p>
          <section className="landing-pricing">
            <p className="landing-pricing-text">
              <strong>Free to try</strong> &mdash; no payment required. Test with up to 5 songs and 1 plan.
            </p>
            <p className="landing-pricing-text">
              Then just <strong>£10&thinsp;/&thinsp;month</strong> or <strong>£100&thinsp;/&thinsp;year</strong> per church.
            </p>
          </section>
          <div className="landing-hero-actions">
            <Link href="/sign-up" className="btn btn-primary landing-cta-btn">Get started free</Link>
            <Link href="/sign-in" className="btn btn-secondary landing-cta-btn">Sign in</Link>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <div className="footer-links">
          <Link href="/feedback" className="footer-link">Contact &amp; Feedback</Link>
          &nbsp;&middot;&nbsp;
          <Link href="/privacy" className="footer-link">Privacy &amp; Cookie Policy</Link>
          &nbsp;&middot;&nbsp;
          <Link href="/legal" className="footer-link">Legal</Link>
          &nbsp;&middot;&nbsp;
          <CookieSettingsLink />
        </div>
        <div className="footer-copy">Song Stack &copy; 2026 <a href="https://www.ninefootone.co.uk/" target="_blank" rel="noopener noreferrer" className="footer-brand-link">ninefootone creative ltd</a></div>
      </footer>
    </div>
  )
}
