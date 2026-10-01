'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

// Last-resort boundary: only used if the root layout itself fails. Replaces the whole
// document, so it must render its own <html>/<body> and can't rely on app CSS.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Song Stack] Global error:', error)
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '4rem 1rem' }}>
        <h1>Something went wrong</h1>
        <p>Song Stack hit an unexpected problem. Please try again.</p>
        <button type="button" onClick={() => reset()} style={{ padding: '8px 16px', fontSize: 16 }}>
          Try again
        </button>
      </body>
    </html>
  )
}
