// Sentry error monitoring. MUST be required before anything else in index.js so it can
// instrument Express and other libraries. Does nothing unless SENTRY_DSN is set
// (set it in Railway; leave it unset locally).
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.RAILWAY_ENVIRONMENT_NAME || process.env.NODE_ENV || 'development',
    // @sentry/node v11 replaced sendDefaultPii with dataCollection, and its defaults collect MORE
    // (cookies, headers incl. Authorization, request bodies, query params, user info).
    // Switch everything off: this API handles church member data and Clerk bearer tokens.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: 0, // errors only
  });
}

module.exports = Sentry;
