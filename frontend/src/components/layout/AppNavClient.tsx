'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { LogOut, HelpCircle, Home, BarChart2, UserCircle, Check, Plus, Users, Settings } from 'lucide-react'
import { useChurch } from '@/context/ChurchContext'

const navLinks = [
  { href: '/dashboard', label: <Home size={16} />,        adminOnly: false },
  { href: '/songs',     label: 'Songs',                   adminOnly: false },
  { href: '/plans',     label: 'Plans',                   adminOnly: false },
  { href: '/discover',  label: 'Discover',                adminOnly: false },
  { href: '/team',      label: 'Team',                    adminOnly: true  },
  { href: '/settings',  label: 'Settings',                adminOnly: true  },
  { href: '/stats',     label: <BarChart2 size={16} strokeWidth={2.5} />, adminOnly: false },
]

// Church list + "join or create another" link, shown in the account menu.
// The list only appears for people in more than one church.
function ChurchSwitcher({ onNavigate }: { onNavigate: () => void }) {
  const { church, churches, switchChurch } = useChurch()
  return (
    <div className="nav-dropdown-churches">
      {churches.length > 1 && (
        <>
          <p className="nav-dropdown-section-label">Your churches</p>
          {churches.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onNavigate(); switchChurch(c.id) }}
              className={`app-nav-mobile-link nav-signout-btn nav-church-option ${c.id === church?.id ? 'is-active' : ''}`}
              aria-current={c.id === church?.id ? 'true' : undefined}
            >
              <span className="nav-church-option-name">{c.name}</span>
              {c.id === church?.id && <Check size={16} />}
            </button>
          ))}
        </>
      )}
      <Link href="/onboarding?add=1" className="app-nav-mobile-link nav-signout-btn" onClick={onNavigate}>
        <Plus size={16} /> Join or create another church
      </Link>
    </div>
  )
}

export function AppNavClient() {
  const pathname = usePathname()
  const { church, loading, isAdmin } = useChurch()
  const { signOut, user } = useClerk()
  const churchName = loading ? '…' : (church?.name || 'SongStack')
  const [menuOpen, setMenuOpen] = useState(false)
  const close = () => setMenuOpen(false)

  // Esc closes the account menu
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const visibleLinks = navLinks.filter(link => !link.adminOnly || isAdmin)

  const avatarInitial = (user?.firstName || user?.emailAddresses[0]?.emailAddress || '?').charAt(0).toUpperCase()

  return (
    <nav className="app-nav">
      <div className="app-nav-inner">
        <div className="app-nav-left">
          <Link href="/dashboard" className="app-nav-brand" onClick={close}>
            {church?.logo_url
              ? <img src={church.logo_url} alt={churchName} className="nav-church-logo" />
              : <><img src="/logo-icon.svg" alt="SongStack" className="nav-logo-icon" /><span className="app-nav-brand-name">{churchName}</span></>
            }
          </Link>
          <span className="app-nav-sep">·</span>
          {/* Desktop page links — on phones these live in the bottom tab bar */}
          <div className="app-nav-links">
            {visibleLinks.map(link => (
              <Link key={link.href} href={link.href} className={`app-nav-link ${isActive(link.href) ? 'is-active' : ''}`}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="app-nav-right">
          <Link href="/help" className="app-nav-help" title="Help &amp; support">
            <HelpCircle size={20} />
          </Link>

          {/* Avatar + account menu: a dropdown on desktop, a bottom sheet on phones (CSS) */}
          <div className="app-nav-user">
            {user && (
              <>
                <button onClick={() => setMenuOpen(!menuOpen)} className="nav-avatar-btn" aria-label="Account menu" aria-expanded={menuOpen}>
                  {user.imageUrl
                    ? <img src={user.imageUrl} alt="" className="nav-avatar-img nav-avatar-sm" />
                    : <div className="nav-avatar-initials nav-avatar-sm">{avatarInitial}</div>
                  }
                </button>
                {menuOpen && (
                  <>
                    <div onClick={close} className="nav-backdrop" />
                    <div className="nav-dropdown" role="menu">
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

                      {/* Phones only: pages that aren't in the tab bar. Desktop has them in the top bar. */}
                      <div className="nav-dropdown-church">
                        <p className="nav-dropdown-section-label">{churchName}</p>
                        {isAdmin && (
                          <>
                            <Link href="/team" className={`app-nav-mobile-link nav-signout-btn ${isActive('/team') ? 'is-active' : ''}`} onClick={close}>
                              <Users size={16} /> Team
                            </Link>
                            <Link href="/settings" className={`app-nav-mobile-link nav-signout-btn ${isActive('/settings') ? 'is-active' : ''}`} onClick={close}>
                              <Settings size={16} /> Church settings
                            </Link>
                          </>
                        )}
                        <Link href="/stats" className={`app-nav-mobile-link nav-signout-btn ${isActive('/stats') ? 'is-active' : ''}`} onClick={close}>
                          <BarChart2 size={16} /> Stats
                        </Link>
                      </div>

                      <ChurchSwitcher onNavigate={close} />
                      <div className="nav-dropdown-footer">
                        <Link href="/account" className={`app-nav-mobile-link nav-signout-btn ${isActive('/account') ? 'is-active' : ''}`} onClick={close}>
                          <UserCircle size={16} /> Account
                        </Link>
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
        </div>
      </div>
    </nav>
  )
}
