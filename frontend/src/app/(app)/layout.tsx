import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { ChurchProvider } from '@/context/ChurchContext'
import { AppNavClient } from '@/components/layout/AppNavClient'

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
          Song Stack · Legal · Privacy · Copyright
        </footer>
      </div>
    </ChurchProvider>
  )
}
