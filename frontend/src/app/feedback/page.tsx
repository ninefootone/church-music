import Link from 'next/link'
import LegalNavActions from '@/components/ui/LegalNavActions'
import FeedbackForm from '@/components/ui/FeedbackForm'

export const metadata = {
  title: 'Get in touch | Song Stack',
}

export default function FeedbackPage() {
  return (
    <div className="legal-page">
      <nav className="landing-nav">
        <div className="landing-nav-brand">
          <Link href="/">
            <img src="/logo.svg" alt="Song Stack" className="landing-nav-logo" />
          </Link>
        </div>
        <LegalNavActions />
      </nav>

      <main className="legal-content">
        <h1>Help &amp; technical support</h1>
        <p className="legal-updated">This form goes directly to the Song Stack team — not your church admin. Use it for bug reports, technical issues, or feature suggestions.</p>
        <FeedbackForm />
      </main>

      <footer className="app-footer">
        <div className="footer-links">
          <Link href="/feedback" className="footer-link">Contact &amp; Feedback</Link>
          &nbsp;&middot;&nbsp;
          <Link href="/privacy" className="footer-link">Privacy &amp; Cookie Policy</Link>
          &nbsp;&middot;&nbsp;
          <Link href="/legal" className="footer-link">Legal</Link>
        </div>
        <div className="footer-copy">Song Stack &copy; 2026 <a href="https://www.ninefootone.co.uk/" target="_blank" rel="noopener noreferrer" className="footer-brand-link">ninefootone creative ltd</a></div>
      </footer>
    </div>
  )
}