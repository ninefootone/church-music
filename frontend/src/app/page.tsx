import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CookieSettingsLink from '@/components/ui/CookieSettingsLink'

// Logged-out home page for app.songstack.church. Styled to match the marketing
// site (songstack.church): blue nav bar, photo hero, Degular headings.
// Features and pricing live on the marketing site only — link there rather than
// repeating them here, so the two can't drift apart.
export default async function HomePage() {
  // If already signed in, go straight to dashboard
  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  return (
    <div className="home-page">
      {/* Fonts to match songstack.church — loaded on this page only, not app-wide:
          Degular (Adobe Fonts kit) for the heading, General Sans (Fontshare) for body text */}
      <link rel="stylesheet" href="https://use.typekit.net/waf6equ.css" />
      <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap" />

      <nav className="home-nav">
        <a href="https://songstack.church/" className="home-nav-brand">
          <img src="/logo-white.svg" alt="SongStack" className="home-nav-logo" />
        </a>
        <div className="home-nav-actions">
          <Link href="/sign-in" className="home-nav-link">Sign in</Link>
          <Link href="/sign-up" className="btn home-btn-light">Start free</Link>
        </div>
      </nav>

      <header className="home-hero">
        <div className="home-hero-inner">
          <p className="home-hero-kicker">Your church&rsquo;s song library</p>
          <h1 className="home-hero-title">SongStack</h1>
        </div>
      </header>

      <main className="home-intro">
        <div className="home-intro-inner">
          <p className="home-intro-text">
            Manage your songs, build plans, and share your music &ndash; all in one place, for your whole team.
          </p>
          <p className="home-intro-note">
            <strong>Free to try</strong> &mdash; no payment required. Test with up to 5 songs and 1 plan.
          </p>
          <div className="home-intro-actions">
            <Link href="/sign-up" className="btn btn-primary home-cta-btn">Start free</Link>
            <Link href="/sign-in" className="btn home-btn-outline home-cta-btn">Sign in</Link>
          </div>
          <p className="home-intro-more">
            <a href="https://songstack.church/">See features and pricing &rarr;</a>
          </p>
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
        <div className="footer-copy">SongStack &copy; 2026 <a href="https://www.ninefootone.co.uk/" target="_blank" rel="noopener noreferrer" className="footer-brand-link">ninefootone creative ltd</a></div>
      </footer>
    </div>
  )
}
