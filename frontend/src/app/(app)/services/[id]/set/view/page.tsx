'use client'
import dynamic from 'next/dynamic'

const SetViewerPage = dynamic(() => import('./SetViewer').then(m => m.SetViewerPage), { ssr: false })

export default function Page() {
  return <SetViewerPage />
}
