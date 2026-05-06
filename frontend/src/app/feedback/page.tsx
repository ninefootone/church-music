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
        <h1>Get in touch</h1>
        <p className="legal-updated">Bug report, question, or feedback — we&apos;d love to hear from you.</p>
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
        <div className="footer-copy">Song Stack &copy; 2026 ninefootone creative ltd</div>
      </footer>
    </div>
  )
}