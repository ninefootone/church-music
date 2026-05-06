import Link from 'next/link'

export const metadata = {
  title: 'Privacy & Cookie Policy | Song Stack',
}

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <nav className="landing-nav">
        <div className="landing-nav-brand">
          <Link href="/">
            <img src="/logo.svg" alt="Song Stack" className="landing-nav-logo" />
          </Link>
        </div>
        <div className="landing-nav-actions">
          <Link href="/sign-in" className="landing-nav-link">Sign in</Link>
          <Link href="/sign-up" className="btn btn-primary">Get started</Link>
        </div>
      </nav>

      <main className="legal-content">
        <h1>Privacy &amp; Cookie Policy</h1>
        <p className="legal-updated">Last updated: May 2026</p>

        <p>This policy covers both <strong>songstack.church</strong> and <strong>app.songstack.church</strong> (together, &ldquo;the Service&rdquo;), operated by <strong>ninefootone creative ltd</strong>, a company registered in England and Wales.</p>

        <h2>1. What data we collect</h2>
        <p>When you create an account we collect your name and email address via Clerk, our authentication provider. If you are part of a church organisation on the Service, we also store the songs, plans, and files you upload.</p>
        <p>We collect anonymised usage data (pages visited, features used) via Google Analytics to help us improve the Service. No personally identifiable information is sent to Google Analytics.</p>

        <h2>2. How we use your data</h2>
        <ul>
          <li>To provide and maintain your account and your church&apos;s song library</li>
          <li>To send essential service emails (e.g. invitations, password resets) via Clerk</li>
          <li>To analyse how the Service is used so we can improve it</li>
          <li>To comply with legal obligations</li>
        </ul>
        <p>We do not sell your data to third parties.</p>

        <h2>3. Data storage &amp; security</h2>
        <p>Your account data is stored securely by Clerk. Song and plan data is stored in a PostgreSQL database hosted on Railway. Uploaded files are stored in Cloudflare R2. All data is encrypted in transit via HTTPS.</p>

        <h2>4. Data retention</h2>
        <p>We retain your data for as long as your account is active. You may request deletion of your account and associated data by emailing <a href="mailto:hello@songstack.church">hello@songstack.church</a>. We will process deletion requests within 30 days.</p>

        <h2>5. Your rights (UK GDPR)</h2>
        <p>As a UK resident you have the right to access, correct, or erase your personal data; to restrict or object to its processing; and to data portability. To exercise any of these rights, contact us at <a href="mailto:hello@songstack.church">hello@songstack.church</a>.</p>

        <h2>6. Cookies</h2>
        <p>We use the following cookies:</p>
        <ul>
          <li><strong>Essential cookies</strong> — set by Clerk for authentication. These are strictly necessary and cannot be disabled.</li>
          <li><strong>Analytics cookies</strong> — set by Google Analytics (GA4) to collect anonymised usage data. These are only set if you accept analytics cookies.</li>
        </ul>
        <p>You can withdraw analytics cookie consent at any time by clicking &ldquo;Cookie settings&rdquo; in the footer.</p>

        <h2>7. Third-party services</h2>
        <ul>
          <li><strong>Clerk</strong> (<a href="https://clerk.com/privacy" target="_blank" rel="noopener">clerk.com/privacy</a>) — authentication</li>
          <li><strong>Google Analytics</strong> (<a href="https://policies.google.com/privacy" target="_blank" rel="noopener">policies.google.com/privacy</a>) — anonymised usage analytics</li>
          <li><strong>Railway</strong> (<a href="https://railway.app/legal/privacy" target="_blank" rel="noopener">railway.app/legal/privacy</a>) — database hosting</li>
          <li><strong>Cloudflare</strong> (<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">cloudflare.com/privacypolicy</a>) — file storage &amp; CDN</li>
        </ul>

        <h2>8. Contact</h2>
        <p>For any privacy-related questions, contact us at <a href="mailto:hello@songstack.church">hello@songstack.church</a> or write to ninefootone creative ltd, England, UK.</p>
      </main>

      <footer className="app-footer">
        <Link href="/privacy" className="footer-link">Privacy &amp; Cookie Policy</Link>
        &nbsp;&middot;&nbsp;
        <Link href="/legal" className="footer-link">Legal</Link>
        &nbsp;&middot;&nbsp;
        Song Stack &copy; 2026 ninefootone creative ltd
      </footer>
    </div>
  )
}