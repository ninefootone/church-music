'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { Menu, X, LogOut } from 'lucide-react'
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
  const [desktopOpen, setDesktopOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const Avatar = ({ size }: { size: number }) => user?.imageUrl ? (
    <img src={user.imageUrl} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--color-brand-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, color: 'var(--color-brand-700)', flexShrink: 0 }}>
      {(user?.firstName || user?.emailAddresses[0]?.emailAddress || '?').charAt(0).toUpperCase()}
    </div>
  )

  const UserInfo = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px var(--space-lg)', borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--space-xs)', overflow: 'hidden' }}>
      <Avatar size={40} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Account'}
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.emailAddresses[0]?.emailAddress}
        </p>
      </div>
    </div>
  )

  const NavLinks = ({ onClose }: { onClose: () => void }) => (
    <>
      {navLinks.map(link => (
        <Link
          key={link.href}
          href={link.href}
          className={`app-nav-mobile-link ${isActive(link.href) ? 'is-active' : ''}`}
          onClick={onClose}
        >
          {link.label}
        </Link>
      ))}
      <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-xs)', padding: 'var(--space-sm) 0' }}>
        <button
          onClick={() => signOut({ redirectUrl: '/' })}
          className="app-nav-mobile-link"
          style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-text-secondary)' }}
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </>
  )

  return (
    <>
      <nav className="app-nav">
        <div className="app-nav-inner">
          <div className="app-nav-left">
            <Link href="/dashboard" className="app-nav-brand" onClick={() => { setDesktopOpen(false); setMobileOpen(false) }}>
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
            {/* Desktop: avatar + dropdown */}
            <div className="app-nav-user-desktop" style={{ position: 'relative' }}>
              {user && (
                <>
                  <button
                    onClick={() => setDesktopOpen(!desktopOpen)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <Avatar size={32} />
                  </button>
                  {desktopOpen && (
                    <>
                      <div onClick={() => setDesktopOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
                      <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 260, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 99 }}>
                        <UserInfo />
                        <NavLinks onClose={() => setDesktopOpen(false)} />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Mobile: hamburger */}
            <button
              className="app-nav-hamburger"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <>
          <div onClick={()