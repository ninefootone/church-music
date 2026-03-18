'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { Music } from 'lucide-react'

const navLinks = [
  { href: '/dashboard', label: 'Home' },
  { href: '/songs',     label: 'Songs' },
  { href: '/services',  label: 'Services' },
  { href: '/stats',     label: 'Stats' },
]

export function AppNav({ churchName }: { churchName: string }) {
  const pathname = usePathname()

  return (
    <nav
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '0 var(--space-lg)',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          <Link
            href="/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.01em',
              textDecoration: 'none',
            }}
          >
            <Music size={16} style={{ color: 'var(--color-brand-500)' }} />
            {churchName}
          </Link>

          <span style={{ color: 'var(--color-border)', margin: '0 4px', fontSize: 18 }}>·</span>

          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: isActive ? 'var(--color-brand-600)' : 'var(--color-text-secondary)',
                  background: isActive ? 'var(--color-brand-50)' : 'transparent',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  textDecoration: 'none',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </nav>
  )
}
