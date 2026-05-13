import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="not-found-page">
      <div className="not-found-inner">
        <div className="not-found-icon">♪</div>
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