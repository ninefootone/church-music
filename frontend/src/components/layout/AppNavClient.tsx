'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { Music, Menu, X } from 'lucide-react'
import { useChurch } from '@/context/ChurchContext'

const navLinks = [
  { href: '/dashboard', label: 'Home' },
  { href: '/songs',     label: 'Songs' },
  { href: '/services',  label: 'Services' },
  { href: '/stats',     label: 'Stats' },
]

export function AppNavClient() {
  const pathname = usePathname()
  const { church, loading } = useChurch()
  const churchName = loading ? '…' : (church?.name || 'Song Stack')
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      <nav className="app-nav">
        <div className="app-nav-inner">
          <div className="app-nav-left">
            <Link href="/dashboard" className="app-nav-brand">
              <Music size={18} />
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
            <UserButton afterSignOutUrl="/" />
            <button
              className="app-nav-hamburger"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="app-nav-mobile" onClick={() => setMenuOpen(false)}>
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`app-nav-mobile-link ${isActive(link.href) ? 'is-active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
