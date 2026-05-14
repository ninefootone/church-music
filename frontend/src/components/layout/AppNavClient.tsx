'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { Menu, X, LogOut, HelpCircle, Home, BarChart2 } from 'lucide-react'
import { useChurch } from '@/context/ChurchContext'

const navLinks = [
  { href: '/dashboard', label: <Home size={16} />,        dropdownLabel: 'Home',  adminOnly: false },
  { href: '/songs',     label: 'Songs',                   adminOnly: false },
  { href: '/plans',     label: 'Plans',                   adminOnly: false },
  { href: '/discover',  label: 'Discover',                adminOnly: false },
  { href: '/team',      label: 'Team',                    adminOnly: true  },
  { href: '/settings',  label: 'Settings',                adminOnly: true  },
  { href: '/stats',     label: <BarChart2 size={16} strokeWidth={2.5} />,   dropdownLabel: 'Stats', adminOnly: false },
]

export function AppNavClient() {
  const pathname = usePathname()
  const { church, loading, isAdmin } = useChurch()
  const { signOut, user } = useClerk()
  const churchName = loading ? '…' : (church?.name || 'Song Stack')
  const [desktopOpen, setDesktopOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const visibleLinks = navLinks.filter(link => !link.adminOnly || isAdmin)

  const avatarInitial = (user?.firstName || user?.emailAddresses[0]?.emailAddress || '?').charAt(0).toUpperCase()

  return (
    <>
      <nav className="app-nav">
        <div className="app-nav-inner">
          <div className="app-nav-left">
            <Link href="/dashboard" className="app-nav-brand" onClick={() => { setDesktopOpen(false); setMobileOpen(false) }}>
              {church?.logo_url
                ? <img src={church.logo_url} alt={churchName} className="nav-church-logo" />
                : <><img src="/logo-icon.svg" alt="Song Stack" className="nav-logo-icon" />{churchName}</>
              }
            </Link>
            <span className="app-nav-sep">·</span>
            <div className="app-nav-links">
              {visibleLinks.map(link => (
                <Link key={link.href} href={link.href} className={`app-nav-link ${isActive(link.href) ? 'is-active' : ''}`}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="app-nav-right">
            {/* Help */}
            <Link href="/help" className="app-nav-help" title="Help &amp; support">
              <HelpCircle size={20} />
            </Link>

            {/* Desktop avatar + dropdown */}
            <div className="app-nav-user-desktop">
              {user && (
                <>
                  <button onClick={() => setDesktopOpen(!desktopOpen)} className="nav-avatar-btn">
                    {user.imageUrl
                      ? <img src={user.imageUrl} alt="" className="nav-avatar-img nav-avatar-sm" />
                      : <div className="nav-avatar-initials nav-avatar-sm">{avatarInitial}</div>
                    }
                  </button>
                  {desktopOpen && (
                    <>
                      <div onClick={() => setDesktopOpen(false)} className="nav-backdrop" />
                      <div className="nav-dropdown">
                        <div className="nav-dropdown-user">
                          {user.imageUrl
                            ? <img src={user.imageUrl} alt="" className="nav-avatar-img nav-avatar-lg" />
                            : <div className="nav-avatar-initials nav-avatar-lg">{avatarInitial}</div>
                          }
                          <div className="nav-user-info">
                            <p className="nav-user-name">
                              {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Account'}
                            </p>
                            <p className="nav-user-email">
                              {user.emailAddresses[0]?.emailAddress}
                            </p>
                          </div>
                        </div>
                        {visibleLinks.map(link => (
                          <Link key={link.href} href={link.href} className={`app-nav-mobile-link ${isActive(link.href) ? 'is-active' : ''}`} onClick={() => setDesktopOpen(false)}>
                            {'dropdownLabel' in link ? link.dropdownLabel : link.label}
                          </Link>
                        ))}
                        <div className="nav-dropdown-footer">
                          <button onClick={() => signOut({ redirectUrl: '/' })} className="app-nav-mobile-link nav-signout-btn">
                            <LogOut size={16} /> Sign out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button className="app-nav-hamburger" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <>
          <div onClick={() => setMobileOpen(false)} className="nav-backdrop nav-backdrop--dim" />
          <div className="app-nav-mobile">
            {user && (
              <div className="nav-dropdown-user">
                {user.imageUrl
                  ? <img src={user.imageUrl} alt="" className="nav-avatar-img nav-avatar-lg" />
                  : <div className="nav-avatar-initials nav-avatar-lg">{avatarInitial}</div>
                }
                <div className="nav-user-info">
                  <p className="nav-user-name">
                    {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Account'}
                  </p>
                  <p className="nav-user-email">
                    {user.emailAddresses[0]?.emailAddress}
                  </p>
                </div>
              </div>
            )}
            {visibleLinks.map(link => (
              <Link key={link.href} href={link.href} className={`app-nav-mobile-link ${isActive(link.href) ? 'is-active' : ''}`} onClick={() => setMobileOpen(false)}>
                {'dropdownLabel' in link ? link.dropdownLabel : link.label}
              </Link>
            ))}
            <div className="nav-dropdown-footer">
              <button onClick={() => signOut({ redirectUrl: '/' })} className="app-nav-mobile-link nav-signout-btn">
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
