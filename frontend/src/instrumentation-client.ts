import * as Sentry from '@sentry/nextjs'

// Browser error reporting. Silent unless NEXT_PUBLIC_SENTRY_DSN is set.
// No session replay and no performance tracing: errors only.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
    // v11 replaced sendDefaultPii with dataCollection, and its defaults collect MORE
    // (cookies, headers, bodies, user info). Switch everything off explicitly.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: 0,
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
