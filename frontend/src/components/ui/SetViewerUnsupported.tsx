'use client'
import Link from 'next/link'

// Shown instead of the set viewer on browsers too old for its PDF engine (iPadOS 15 and earlier).
export default function SetViewerUnsupported({ backHref }: { backHref: string }) {
  return (
    <div className="set-viewer-loading" style={{ flexDirection: 'column', gap: 12, textAlign: 'center', padding: 24 }}>
      <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>This device&rsquo;s browser is too old for the set viewer</p>
      <p style={{ maxWidth: 440, lineHeight: 1.5 }}>
        The set viewer needs iPadOS 16.4 or later (or an up-to-date browser). You can still open each
        song&rsquo;s music from the plan page &mdash; it will open in your browser&rsquo;s own PDF viewer.
      </p>
      <Link href={backHref} className="btn btn-primary">Back to the plan</Link>
    </div>
  )
}