'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { Menu, X, LogOut, User } from 'lucide-react'
import { useChurch } from '@/context/ChurchContext'

const navLinks = [
  { href: '/dashboard', label: 'Home' },
  { href: '/songs',     label: 'Songs' },
  { href: '/services',  label: 'Services' },
  { href: '/stats',     label: 'Stats' },
  { href: '/settings',  label: 'Settings' },
]

export function AppNavClient() {
  const pathname = usePathname()
  const { church, loading } = useChurch()
  const { signOut, user } = useClerk()
  const churchName = loading ? '…' : (church?.name || 'Song Stack')
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const closeMenu = () => setMenuOpen(false)

  return (
    <>
      <nav className="app-nav">
        <div className="app-nav-inner">
          <div className="app-nav-left">
            <Link href="/dashboard" className="app-nav-brand" onClick={closeMenu}>
              <img src="/logo-icon.svg" alt="Song Stack" style={{ height: 28, width: 28, borderRadius: 4 }} />
              {churchName}
            </Link>
            <span className="app-nav-sep">·</span>
            <div className="app-nav-links">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`app-nav-link ${isActive(link.href) ? 'is-active' : ''}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="app-nav-right">
            {/* Desktop: show Clerk UserButton */}
            <div className="app-nav-user-desktop" style={{ position: 'relative' }}>
              {user && (
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  {user.imageUrl ? (
                    <img src={user.imageUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-brand-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--color-brand-700)' }}>
                      {(user.firstName || user.emailAddresses[0]?.emailAddress || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                </button>
              )}
            </div>
            {/* Mobile: hamburger */}
            <button
              className="app-nav-hamburger"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeMenu}
            style={{ position: 'fixed', inset: 0, zIndex: 98, background: 'rgba(0,0,0,0.2)' }}
          />
          <div className="app-nav-mobile">
            {/* User info */}
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px var(--space-lg)', borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--space-xs)' }}>
                {user.imageUrl ? (
                  <img src={user.imageUrl} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-brand-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--color-brand-700)', flexShrink: 0 }}>
                    {(user.firstName || user.emailAddresses[0]?.emailAddress || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
                    {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Account'}
                  </p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                    {user.emailAddresses[0]?.emailAddress}
                  </p>
                </div>
              </div>
            )}

            {/* Nav links */}
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`app-nav-mobile-link ${isActive(link.href) ? 'is-active' : ''}`}
                onClick={closeMenu}
              >
                {link.label}
              </Link>
            ))}

            {/* Sign out */}
            <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-xs)', padding: 'var(--space-sm) 0' }}>
              <button
                onClick={() => signOut({ redirectUrl: '/' })}
                className="app-nav-mobile-link"
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-text-secondary)' }}
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
