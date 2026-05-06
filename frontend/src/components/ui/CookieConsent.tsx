'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent')
    if (!consent) setVisible(true)

    function handleReopen() {
      setVisible(true)
    }
    window.addEventListener('open-cookie-settings', handleReopen)
    return () => window.removeEventListener('open-cookie-settings', handleReopen)
  }, [])

  function accept() {
    localStorage.setItem('cookie_consent', 'accepted')
    setVisible(false)
    // Enable GA
    if (typeof window !== 'undefined' && (window as any).gtag) {
      ;(window as any).gtag('consent', 'update', {
        analytics_storage: 'granted',
      })
    }
  }

  function decline() {
    localStorage.setItem('cookie_consent', 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="cookie-banner">
      <p className="cookie-banner-text">
        We use analytics cookies to understand how Song Stack is used and improve the experience. See our{' '}
        <Link href="/privacy" className="cookie-banner-link">Privacy &amp; Cookie Policy</Link>.
      </p>
      <div className="cookie-banner-actions">
        <button onClick={decline} className="btn btn-secondary cookie-banner-btn">Decline</button>
        <button onClick={accept} className="btn btn-primary cookie-banner-btn">Accept</button>
      </div>
    </div>
  )
}