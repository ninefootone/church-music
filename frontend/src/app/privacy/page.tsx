import Link from 'next/link'
import LegalNavActions from '@/components/ui/LegalNavActions'

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
        <LegalNavActions />
      </nav>

      <main className="legal-content">
        <h1>Privacy &amp; Cookie Policy</h1>
        <p className="legal-updated">Last updated: September 2026</p>

        <p>This policy covers the Song Stack website (<strong>songstack.church</strong>), the web app (<strong>app.songstack.church</strong>) and the Song Stack iPad app (together, &ldquo;the Service&rdquo;), operated by <strong>ninefootone creative ltd</strong>, a company registered in England and Wales.</p>

        <h2>1. What data we collect</h2>
        <p><strong>Account details.</strong> When you create an account we collect your name and email address via Clerk, our authentication provider. If you sign in with Google or Apple, Clerk receives the name and email address those services share with it. If you add a profile photo, Clerk stores it.</p>
        <p><strong>Church content.</strong> If you belong to a church on the Service, we store the songs, lyrics, arrangements, service plans, files and other content you or your church upload, along with your membership of that church, your role, and any dates you mark yourself unavailable. Other members of your church can see your name and email address and the plans you are listed on.</p>
        <p><strong>Markings and annotations.</strong> Personal pen markings you make in the iPad app are stored on your device only. If you share markings with your church, they become church content and are visible to its members.</p>
        <p><strong>Payments.</strong> Church administrators can subscribe to a paid plan. Payments are handled by Stripe. We never see or store card details; we keep only the subscription status and Stripe&apos;s customer and subscription references.</p>
        <p><strong>Feedback.</strong> If you send us a message through the feedback form, we receive the name, email address and message you enter. The form is protected by Google reCAPTCHA, which analyses how you interact with the form to detect bots.</p>
        <p><strong>Usage data (website only).</strong> If you accept analytics cookies, we collect anonymised usage data (pages visited, features used) via Google Analytics. The iPad app does not include analytics or advertising tools and does not track you.</p>

        <h2>2. How we use your data</h2>
        <ul>
          <li>To provide and maintain your account and your church&apos;s song library (contract)</li>
          <li>To send essential service emails, such as invitations, service-plan notifications, verification and password resets (contract)</li>
          <li>To send occasional product updates, only if you opted in (consent)</li>
          <li>To analyse how the website is used so we can improve it, only if you accept analytics cookies (consent)</li>
          <li>To keep the Service secure and prevent abuse (legitimate interests)</li>
          <li>To comply with legal obligations</li>
        </ul>
        <p>We do not sell your data and we do not use it for advertising.</p>

        <h2>3. Data storage &amp; security</h2>
        <p>Account sign-in data is stored by Clerk. Song, plan and membership data is stored in a PostgreSQL database hosted on Railway. Uploaded files are stored in Cloudflare R2. The website and web app are hosted on Vercel. All data is encrypted in transit via HTTPS.</p>
        <p>The iPad app also stores some data on your device so it works offline: downloaded songs and files, your personal markings, custom sets and a copy of your church&apos;s data. This stays on your device until you delete it, sign out of the app or delete your account.</p>

        <h2>4. Data retention &amp; deleting your account</h2>
        <p>We keep your data for as long as your account is active. You can delete your account yourself at any time: on the website, go to Account and choose &ldquo;Delete account&rdquo;; in the iPad app, go to Settings and choose &ldquo;Delete account&rdquo; (you can also do this from the &ldquo;Join your church&rdquo; screen if you are not yet in a church). Deletion is immediate and cannot be undone.</p>
        <p>When you delete your account:</p>
        <ul>
          <li>your account and sign-in details are deleted from Clerk, and your email address is removed from our email contact list;</li>
          <li>your church memberships and unavailability dates are deleted;</li>
          <li>your name on past service plans is replaced with &ldquo;Former member&rdquo;;</li>
          <li>shared markings and other content you contributed to your church remain with the church, without your name attached;</li>
          <li>if you are the last member of a church, that church and all its songs, files and plans are deleted too (we warn you before this happens);</li>
          <li>the iPad app removes everything it stored on your device.</li>
        </ul>
        <p>We cannot delete an account that is the only administrator of a church that still has other members (make another member an administrator first), or that belongs to a church with an active subscription (cancel the subscription first).</p>
        <p>Some information is kept after deletion where we have to: payment and invoice records are retained by Stripe and by us for tax and accounting purposes, and emails you have sent us (for example via the feedback form) may be kept for as long as needed to respond and keep a record. We also take a nightly backup of our database and keep the most recent 14, so deleted data may remain in a backup for up to 14 days before it is overwritten.</p>

        <h2>5. Your rights (UK GDPR)</h2>
        <p>As a UK resident you have the right to access, correct, or erase your personal data; to restrict or object to its processing; to withdraw consent at any time; and to data portability. You can correct your name and email in your account settings and delete your account as described above. For anything else, contact us at <a href="mailto:hello@songstack.church">hello@songstack.church</a>. You also have the right to complain to the Information Commissioner&apos;s Office (<a href="https://ico.org.uk" target="_blank" rel="noopener">ico.org.uk</a>).</p>

        <h2>6. Cookies</h2>
        <p>On the website we use the following cookies:</p>
        <ul>
          <li><strong>Essential cookies</strong> — set by Clerk for authentication. These are strictly necessary and cannot be disabled.</li>
          <li><strong>Analytics cookies</strong> — set by Google Analytics (GA4) to collect anonymised usage data. These are only set if you accept analytics cookies.</li>
        </ul>
        <p>You can withdraw analytics cookie consent at any time by clicking &ldquo;Cookie settings&rdquo; in the footer. The iPad app does not use analytics cookies.</p>

        <h2>7. Third-party services</h2>
        <p>We share data only with the providers we need to run the Service:</p>
        <ul>
          <li><strong>Clerk</strong> (<a href="https://clerk.com/privacy" target="_blank" rel="noopener">clerk.com/privacy</a>) — authentication and account sign-in</li>
          <li><strong>Railway</strong> (<a href="https://railway.app/legal/privacy" target="_blank" rel="noopener">railway.app/legal/privacy</a>) — database and server hosting</li>
          <li><strong>Cloudflare</strong> (<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">cloudflare.com/privacypolicy</a>) — file storage &amp; CDN</li>
          <li><strong>Vercel</strong> (<a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener">vercel.com/legal/privacy-policy</a>) — website hosting</li>
          <li><strong>Stripe</strong> (<a href="https://stripe.com/gb/privacy" target="_blank" rel="noopener">stripe.com/gb/privacy</a>) — subscription payments</li>
          <li><strong>Brevo</strong> (<a href="https://www.brevo.com/legal/privacypolicy/" target="_blank" rel="noopener">brevo.com/legal/privacypolicy</a>) — sending emails and managing our email contact list</li>
          <li><strong>Google Analytics</strong> and <strong>reCAPTCHA</strong> (<a href="https://policies.google.com/privacy" target="_blank" rel="noopener">policies.google.com/privacy</a>) — anonymised usage analytics (website, with consent) and spam protection on the feedback form</li>
          <li><strong>Expo</strong> (<a href="https://expo.dev/privacy" target="_blank" rel="noopener">expo.dev/privacy</a>) — delivers updates to the iPad app</li>
          <li><strong>Apple</strong> — distributes the iPad app through the App Store and TestFlight</li>
        </ul>
        <p>Some of these providers process data outside the UK; where they do, they rely on recognised safeguards such as the UK International Data Transfer Addendum or an adequacy decision.</p>

        <h2>8. Children</h2>
        <p>Song Stack is a tool for churches and is not aimed at children. Accounts are for people aged 13 or over. Churches decide who they invite to use the Service, and a church that invites someone under 18 is responsible for having the permission of that person&apos;s parent or guardian.</p>

        <h2>9. Changes to this policy</h2>
        <p>If we make significant changes we will update the date at the top of this page and, where appropriate, tell you by email or in the app.</p>

        <h2>10. Contact</h2>
        <p>For any privacy-related questions, contact us at <a href="mailto:hello@songstack.church">hello@songstack.church</a> or write to ninefootone creative ltd, England, UK.</p>
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