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

module.exports = nextConfig
