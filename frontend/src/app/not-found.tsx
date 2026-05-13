import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <div className="not-found-page">
      <div className="not-found-inner">
        <Image src="/logo-icon.svg" alt="Song Stack" width={72} height={72} className="not-found-icon" />
        <h1 className="not-found-title">Page not found</h1>
        <p className="not-found-body">
          This page doesn&apos;t exist or may have been moved.
        </p>
        <Link href="/dashboard" className="not-found-btn">
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}