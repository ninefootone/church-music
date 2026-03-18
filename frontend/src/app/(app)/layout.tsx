import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { AppNav } from '@/components/layout/AppNav'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const churchName = 'My Church'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <AppNav churchName={churchName} />
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
  )
}
