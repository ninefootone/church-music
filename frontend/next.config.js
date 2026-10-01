const { withSentryConfig } = require('@sentry/nextjs/config')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  // Set viewer: use pdf.js's LEGACY build (react-pdf imports 'pdfjs-dist'). The modern build calls
  // Promise.withResolvers (Safari 17.4+) and crashed the set viewer on iPadOS 16.4–17.3; the legacy
  // build polyfills it. iPadOS < 16.4 is handled by the fallback in set/view/page.tsx.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'pdfjs-dist$': require.resolve('pdfjs-dist/legacy/build/pdf.mjs'),
    }
    return config
  },
}

// Sentry build wrapper. Source-map upload (readable stack traces) only happens when
// SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT are set in the build environment (Vercel).
module.exports = withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  widenClientFileUpload: true,
})
