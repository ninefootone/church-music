'use client'
import dynamic from 'next/dynamic'

const PublicSetViewerPage = dynamic(() => import('./PublicSetViewer').then(m => m.PublicSetViewerPage), { ssr: false })

export default function Page() {
  return <PublicSetViewerPage />
}
