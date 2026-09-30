import Link from 'next/link'
import LegalNavActions from '@/components/ui/LegalNavActions'

export const metadata = {
  title: 'Support | Song Stack',
}

// Public support page. Used as the App Store "Support URL", which Apple requires to show real contact details.
export default function SupportPage() {
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
        <h1>Support</h1>

        <h2>Contact us</h2>
        <p>Email <a href="mailto:hello@songstack.church">hello@songstack.church</a> and we&apos;ll get back to you as soon as we can. It helps if you tell us which church you belong to, whether you&apos;re using the website or the iPad app, and what you were trying to do.</p>
        <p>For questions about your church&apos;s songs, plans or who has access, your church&apos;s admins can usually help fastest.</p>

        <h2>Help guides</h2>
        <p><strong>iPad app:</strong> open the <strong>Help</strong> tab at the bottom of the screen. It covers playing a set, marking up music, foot pedals and working offline, and it works without an internet connection.</p>
        <p><strong>Website:</strong> sign in and choose <strong>Help</strong> from the menu, or go to <Link href="/help">app.songstack.church/help</Link>.</p>

        <h2>Deleting your account</h2>
        <p>You can delete your account yourself at any time. On the website, open the avatar menu, choose <strong>Account</strong> and use <strong>Delete account</strong>. In the iPad app, go to <strong>Settings</strong> and use <strong>Delete account</strong> at the bottom. Our <Link href="/privacy">privacy policy</Link> explains what is removed.</p>

        <h2>Copyright concerns</h2>
        <p>Churches add their own songs and files to Song Stack and are responsible for holding the licences they need. If you believe content on Song Stack infringes your copyright, email <a href="mailto:hello@songstack.church">hello@songstack.church</a> with details of the work and where it appears. We&apos;ll look into it and remove content where appropriate.</p>

        <h2>Who we are</h2>
        <p>Song Stack is run by ninefootone creative ltd, a company registered in England and Wales. See also our <Link href="/privacy">Privacy &amp; Cookie Policy</Link> and <Link href="/legal">Terms</Link>.</p>
      </main>

      <footer className="app-footer">
        <div className="footer-links">
          <Link href="/support" className="footer-link">Support</Link>
          &nbsp;&middot;&nbsp;
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
