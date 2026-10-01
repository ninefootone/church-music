'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

// Catches render errors in any (app) page. Because it sits inside (app)/layout.tsx,
// the nav and footer stay on screen and only the page content is replaced.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Song Stack] Page error:', error)
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="not-found-page">
      <div className="not-found-inner">
        <h1 className="not-found-title">Something went wrong</h1>
        <p className="not-found-body">
          This page hit a problem, but the rest of Song Stack is still working.
          Try again, or head back to your dashboard. If it keeps happening, please let us know via Contact &amp; Feedback.
        </p>
        <button type="button" onClick={() => reset()} className="not-found-btn">
          Try again
        </button>
        <p className="not-found-body">
          <Link href="/dashboard">Go to dashboard</Link>
        </p>
        {error.digest && <p className="not-found-body">Reference: {error.digest}</p>}
      </div>
    </div>
  )
}
