import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { AppNav } from '@/components/layout/AppNav'
import { ChurchProvider } from '@/context/ChurchContext'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <ChurchProvider>
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <AppNavWrapper />
        <main
          style={{
            maxWidth: 960,
            margin: '0 auto',
            padding: 'var(--space-xl) var(--space-lg)',
          }}
        >
          {children}
        </main>
        <footer
          style={{
            textAlign: 'center',
            padding: 'var(--space-xl) var(--space-lg)',
            fontSize: 11,
            color: 'var(--color-text-muted)',
            borderTop: '1px solid var(--color-border)',
            marginTop: 'var(--space-xl)',
          }}
        >
          Church Music · Legal · Privacy · Copyright
        </footer>
      </div>
    </ChurchProvider>
  )
}

// Client component wrapper so AppNav can use the church context
import { AppNavClient } from '@/components/layout/AppNavClient'

function AppNavWrapper() {
  return <AppNavClient />
}
