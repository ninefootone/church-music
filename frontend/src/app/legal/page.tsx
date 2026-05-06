import Link from 'next/link'
import LegalNavActions from '@/components/ui/LegalNavActions'

export const metadata = {
  title: 'Legal | Song Stack',
}

export default function LegalPage() {
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
        <h1>Legal</h1>
        <p className="legal-updated">Last updated: May 2026</p>

        <p>Song Stack is operated by <strong>ninefootone creative ltd</strong>, a company registered in England and Wales.</p>

        <h2>1. Acceptance of terms</h2>
        <p>By creating an account or using the Service, you agree to these terms. If you do not agree, please do not use the Service.</p>

        <h2>2. The Service</h2>
        <p>Song Stack provides churches and worship teams with tools to manage song libraries, build service plans, and share resources with their team. We reserve the right to modify or discontinue the Service at any time, with reasonable notice where possible.</p>

        <h2>3. Your account</h2>
        <p>You are responsible for maintaining the security of your account and for all activity that occurs under it. You must provide accurate information when registering and keep it up to date.</p>

        <h2>4. Acceptable use</h2>
        <p>You agree not to use the Service to upload or share content that infringes third-party intellectual property rights, is unlawful, or is otherwise harmful. You are responsible for ensuring you hold the appropriate licences (e.g. CCLI) for any copyrighted song content you upload.</p>

        <h2>5. Copyright &amp; CCLI</h2>
        <p>Song Stack does not grant any rights to perform, reproduce, or distribute copyrighted worship songs. It is your responsibility as a church to hold a valid <a href="https://ccli.com" target="_blank" rel="noopener">CCLI licence</a> covering the songs you use. Song Stack is not affiliated with CCLI.</p>

        <h2>6. Subscription &amp; payment</h2>
        <p>Song Stack is free to try with up to 5 songs and 1 plan. Continued use beyond these limits requires a paid subscription at the rates published on <a href="https://songstack.church" target="_blank" rel="noopener">songstack.church</a>. Prices are in GBP and inclusive of VAT where applicable. Subscriptions are billed monthly or annually. You may cancel at any time; no refunds are issued for partial periods.</p>

        <h2>7. Limitation of liability</h2>
        <p>To the maximum extent permitted by law, ninefootone creative ltd shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability to you shall not exceed the amount you have paid us in the 12 months preceding the claim.</p>

        <h2>8. Governing law</h2>
        <p>These terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>

        <h2>9. Contact</h2>
        <p>For any legal enquiries, contact us at <a href="mailto:hello@songstack.church">hello@songstack.church</a>.</p>
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