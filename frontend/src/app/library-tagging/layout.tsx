import type { Metadata } from 'next'

// Hidden working page for library helpers — keep it out of search engines.
export const metadata: Metadata = {
  title: 'Library tagging · SongStack',
  robots: { index: false, follow: false },
}

export default function LibraryTaggingLayout({ children }: { children: React.ReactNode }) {
  return children
}
