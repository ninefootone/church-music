import type { Metadata } from 'next'

// Discover-only mode — free song browsing for signed-in users with or without a church.
export const metadata: Metadata = {
  title: 'Song library · SongStack',
  robots: { index: false, follow: false },
}

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return children
}
