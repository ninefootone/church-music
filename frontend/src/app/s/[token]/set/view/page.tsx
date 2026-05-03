'use client'
import dynamic from 'next/dynamic'

const PublicSetViewerPage = dynamic(
  () => import('./PublicSetViewer').then(m => m.PublicSetViewerPage),
  { ssr: false, loading: () => <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>Loading set…</div> }
)

export default function Page() {
  return <PublicSetViewerPage />
}