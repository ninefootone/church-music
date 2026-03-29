<html lang="en">
  <head>
    <link rel="stylesheet" href="https://use.typekit.net/waf6equ.css" />
  </head>
  <body></body>

import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'react-hot-toast'
import './globals.css'
 
export const dynamic = 'force-dynamic'
 
export const metadata: Metadata = {
  title: 'Song Stack',
  description: 'Song library and service planning for churches',
}
 
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/onboarding"
    >
      <html lang="en">
        <body>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                fontFamily: 'Halyard Display, Helvetica Neue, sans-serif',
                fontSize: '14px',
                borderRadius: '10px',
                border: '1px solid var(--color-border)',
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  )
}