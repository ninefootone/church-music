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
      <div className="app-shell">
        <AppNavClient />
        <main className="app-main-content">
          {children}
        </main>
        <footer className="app-footer">
        <Link href="/dashboard"><img src="/logo.svg" alt="Song Stack" className="footer-logo" /></Link>
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
    </ChurchProvider>
  )
}
