'use client'
import dynamic from 'next/dynamic'

const PublicSetViewerPage = dynamic(
  () => import('./PublicSetViewer').then(m => m.PublicSetViewerPage),
  { ssr: false, loading: () => <div className="set-viewer-loading">Loading set…</div> }
)

export default function Page() {
  return <PublicSetViewerPage />
}