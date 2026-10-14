'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Music, CalendarDays, Compass } from 'lucide-react'

// Phone-only bottom navigation (CSS shows it at ≤768px). Team, Church settings and Stats
// live in the avatar menu on phones; desktop keeps every page in the top bar.
const tabs = [
  { href: '/dashboard', label: 'Home',     Icon: Home },
  { href: '/songs',     label: 'Songs',    Icon: Music },
  { href: '/plans',     label: 'Plans',    Icon: CalendarDays },
  { href: '/discover',  label: 'Discover', Icon: Compass },
]

// Pages with their own fixed bottom bar (Save / Cancel) or a full-screen view: no tab bar.
const HIDE_ON = [
  /^\/songs\/new$/,
  /\/edit$/,
  /\/set\/view/,
]

export function MobileTabBar() {
  const pathname = usePathname()
  if (HIDE_ON.some(re => re.test(pathname))) return null

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <nav className="mobile-tabbar" aria-label="Main">
      {tabs.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          className={`mobile-tab ${isActive(href) ? 'is-active' : ''}`}
          aria-current={isActive(href) ? 'page' : undefined}
        >
          <Icon size={22} strokeWidth={isActive(href) ? 2.4 : 2} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
