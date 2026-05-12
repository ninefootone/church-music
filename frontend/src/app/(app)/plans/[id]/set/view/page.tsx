'use client'
import dynamic from 'next/dynamic'

const SetViewerPage = dynamic(
  () => import('./SetViewer').then(m => m.SetViewerPage),
  { ssr: false, loading: () => <div className="set-viewer-loading">Loading set…</div> }
)

export default function Page() {
  return <SetViewerPage />
}
