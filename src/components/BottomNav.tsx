'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'

const PRIMARY = '#5B2A86'
const MUTED = '#9ca3af'

type Tab = {
  href: string
  label: string
  icon: (active: boolean) => React.ReactNode
  exact?: boolean
  center?: boolean
  ownerOnly?: boolean
}

const TABS: Tab[] = [
  {
    href: '/',
    exact: true,
    label: 'Home',
    ownerOnly: true,
    icon: (a) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
          stroke={a ? PRIMARY : MUTED} strokeWidth="1.5" fill={a ? PRIMARY + '1a' : 'none'} strokeLinejoin="round"/>
        <path d="M7.5 18v-5h5v5" stroke={a ? PRIMARY : MUTED} strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/products',
    label: 'Stock',
    ownerOnly: true,
    icon: (a) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 8l6-4 6 4v7a1 1 0 01-1 1H5a1 1 0 01-1-1V8z"
          stroke={a ? PRIMARY : MUTED} strokeWidth="1.5" fill={a ? PRIMARY + '1a' : 'none'} strokeLinejoin="round"/>
        <path d="M10 10v4M8 12h4" stroke={a ? PRIMARY : MUTED} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/sell',
    exact: true,
    label: 'Sell',
    center: true,
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 5v12M5 11h12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/sales',
    label: 'Sales',
    icon: (a) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="5" width="14" height="12" rx="1.5" stroke={a ? PRIMARY : MUTED} strokeWidth="1.5" fill={a ? PRIMARY + '1a' : 'none'}/>
        <path d="M7 5V4a2 2 0 014 0v1" stroke={a ? PRIMARY : MUTED} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M7 10h6M7 13h4" stroke={a ? PRIMARY : MUTED} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/finances',
    label: 'Money',
    ownerOnly: true,
    icon: (a) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="5" width="16" height="10" rx="2" stroke={a ? PRIMARY : MUTED} strokeWidth="1.5" fill={a ? PRIMARY + '1a' : 'none'}/>
        <circle cx="10" cy="10" r="2.5" stroke={a ? PRIMARY : MUTED} strokeWidth="1.5"/>
        <path d="M5 8v4M15 8v4" stroke={a ? PRIMARY : MUTED} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { isOwner } = useAuth()

  // Hide on receipt pages
  if (pathname.includes('/receipt')) return null

  const visibleTabs = TABS.filter(tab => !tab.ownerOnly || isOwner)

  function isActive(tab: Tab) {
    if (tab.exact) return pathname === tab.href
    return pathname.startsWith(tab.href)
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-end"
      style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.12), 0 -4px 24px rgba(0,0,0,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {visibleTabs.map(tab => {
        const active = isActive(tab)

        if (tab.center) {
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center active:scale-95 transition-transform duration-200"
              style={{ textDecoration: 'none', paddingBottom: 12, paddingTop: 8 }}
            >
              <span
                className="flex items-center justify-center"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${PRIMARY} 0%, #4A2270 100%)`,
                  marginTop: -24,
                  boxShadow: '0 8px 24px rgba(91,42,134,0.5), 0 2px 8px rgba(0,0,0,0.15)',
                }}
              >
                {tab.icon(false)}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: PRIMARY, marginTop: 4 }}>
                {tab.label}
              </span>
            </Link>
          )
        }

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex-1 flex flex-col items-center transition-all"
            style={{
              textDecoration: 'none',
              paddingTop: 8,
              paddingBottom: 12,
              borderBottom: active ? `3px solid ${PRIMARY}` : '3px solid transparent',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 32,
                borderRadius: 12,
                background: active ? PRIMARY + '20' : 'rgba(51,71,95,0.06)',
                transition: 'background 0.2s',
              }}
            >
              {tab.icon(active)}
            </span>
            <span style={{
              fontSize: 12,
              fontWeight: active ? 800 : 500,
              color: active ? PRIMARY : MUTED,
              marginTop: 4,
              letterSpacing: active ? '0.02em' : '0',
            }}>
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
