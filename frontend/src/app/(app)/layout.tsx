import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { ChurchProvider } from '@/context/ChurchContext'
import { AppNavClient } from '@/components/layout/AppNavClient'
import Link from 'next/link'
import CookieSettingsLink from '@/components/ui/CookieSettingsLink'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <ChurchProvider>
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <AppNavClient />
        <main
          className="app-main-content"
          style={{ maxWidth: 'var(--width-app)', margin: '0 auto', padding: 'var(--space-xl) var(--space-lg)', overflowX: 'hidden' }}
        >
          {children}
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
        <div className="footer-copy">Song Stack &copy; 2026 ninefootone creative ltd</div>
      </footer>
      </div>
    </ChurchProvider>
  )
}
