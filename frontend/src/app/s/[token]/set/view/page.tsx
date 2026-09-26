'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { canRunSetViewer } from '@/lib/browserSupport'
import SetViewerUnsupported from '@/components/ui/SetViewerUnsupported'

const PublicSetViewerPage = dynamic(
  () => import('./PublicSetViewer').then(m => m.PublicSetViewerPage),
  { ssr: false, loading: () => <div className="set-viewer-loading">Loading set…</div> }
)

export default function Page() {
  const params = useParams() as Record<string, string>
  // Decide on the client only; until then render nothing so the viewer chunk isn't requested.
  const [supported, setSupported] = useState<boolean | null>(null)
  useEffect(() => { setSupported(canRunSetViewer()) }, [])
  if (supported === null) return <div className="set-viewer-loading">Loading set…</div>
  if (!supported) return <SetViewerUnsupported backHref={`/s/${params.token}`} />
  return <PublicSetViewerPage />
}