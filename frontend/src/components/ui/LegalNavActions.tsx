import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'

export default async function LegalNavActions() {
  const { userId } = await auth()

  if (userId) {
    return (
      <div className="landing-nav-actions">
        <Link href="/dashboard" className="btn btn-primary">Go to app</Link>
      </div>
    )
  }

  return (
    <div className="landing-nav-actions">
      <Link href="/sign-in" className="landing-nav-link">Sign in</Link>
      <Link href="/sign-up" className="btn btn-primary">Get started</Link>
    </div>
  )
}