import * as Sentry from '@sentry/nextjs'

// Server + edge error reporting. Does nothing unless NEXT_PUBLIC_SENTRY_DSN is set,
// so local dev and any environment without the variable stay silent.
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return
  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
      // v11 replaced sendDefaultPii with dataCollection, and its defaults collect MORE
      // (cookies, headers, bodies, user info). Switch everything off explicitly.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      tracesSampleRate: 0,   // errors only, no performance tracing (keeps within free quota)
    })
  }
}

// Reports errors thrown in server components, route handlers and server actions.
export const onRequestError = Sentry.captureRequestError
