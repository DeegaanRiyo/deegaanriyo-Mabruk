'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  Package,
  Wallet,
  Users,
  Settings,
  Truck,
  PackagePlus,
  LogOut,
  UserCircle,
  Download,
  UserCog,
  Contact,
} from 'lucide-react'

interface NavItem {
  href:   string
  icon:   React.ReactNode
  label:  string
  exact?: boolean
  ownerOnly?: boolean
}

interface NavSection {
  label: string
  items: NavItem[]
  ownerOnly?: boolean
}

const NAV: NavSection[] = [
  {
    label: 'DASHBOARD',
    ownerOnly: true,
    items: [
      { href: '/', icon: <LayoutDashboard size={15} strokeWidth={2} />, label: 'Dashboard', exact: true },
    ],
  },
  {
    label: 'SALES',
    items: [
      { href: '/sell',  icon: <ShoppingCart  size={15} strokeWidth={2} />, label: 'New Sale', exact: true },
      { href: '/sales', icon: <ClipboardList size={15} strokeWidth={2} />, label: 'Sales History' },
    ],
  },
  {
    label: 'INVENTORY',
    ownerOnly: true,
    items: [
      { href: '/products',      icon: <Package     size={15} strokeWidth={2} />, label: 'Products' },
      { href: '/purchases',     icon: <Truck       size={15} strokeWidth={2} />, label: 'Purchase Orders', exact: true },
      { href: '/purchases/new', icon: <PackagePlus size={15} strokeWidth={2} />, label: 'Add Stock' },
    ],
  },
  {
    label: 'FINANCES',
    ownerOnly: true,
    items: [
      { href: '/finances', icon: <Wallet  size={15} strokeWidth={2} />, label: 'Overview', exact: true },
      { href: '/clients',  icon: <Contact size={15} strokeWidth={2} />, label: 'Clients' },
      { href: '/credits',  icon: <Users   size={15} strokeWidth={2} />, label: 'Credits (Deni)' },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { href: '/settings/profile', icon: <UserCog size={15} strokeWidth={2} />, label: 'My Profile' },
      { href: '/settings/users', icon: <UserCircle size={15} strokeWidth={2} />, label: 'User Management', ownerOnly: true },
    ],
  },
]

interface SidebarProps {
  isOpen:  boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { profile, isOwner, signOut } = useAuth()

  // PWA install prompt
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  // Filter nav by role
  const visibleNav = NAV
    .filter(section => !section.ownerOnly || isOwner)
    .map(section => ({
      ...section,
      items: section.items.filter(item => !item.ownerOnly || isOwner),
    }))
    .filter(section => section.items.length > 0)

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-[99]"
          style={{ background: 'rgba(30,22,38,0.25)' }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 bottom-0 z-[100] flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ width: 240, maxWidth: 'calc(100vw - 56px)', background: '#FFFFFF', borderRight: '1px solid #E8E3ED' }}
      >

        {/* Brand header */}
        <div className="flex flex-col items-center px-5 pt-5 pb-4" style={{ borderBottom: '1px solid #E8E3ED' }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#5B2A86', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 800, flexShrink: 0,
              border: '3px solid #EDE4F5',
            }}
          >
            M
          </div>

          <div style={{ color: '#1E1626', fontSize: 14, fontWeight: 700, marginTop: 10, textAlign: 'center' }}>
            Mabruk Store
          </div>

          <div style={{ color: '#6B6373', fontSize: 9, letterSpacing: '2.5px', textTransform: 'uppercase', marginTop: 3 }}>
            Eastleigh &middot; Nairobi
          </div>

          <div style={{ width: '100%', height: 1, background: '#E8E3ED', margin: '12px 0 0' }} />
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto sidebar-scroll">
          {visibleNav.map(section => (
            <div key={section.label} className="mb-1">
              <div style={{ color: '#6B6373', fontSize: 10.5, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 800, padding: '12px 20px 4px' }}>
                {section.label}
              </div>
              {section.items.map(item => {
                const active = isActive(item)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-5 py-2 transition-all"
                    style={{
                      color:          active ? '#5B2A86' : '#1E1626',
                      background:     active ? '#EDE4F5' : 'transparent',
                      borderLeft:     `3px solid ${active ? '#5B2A86' : 'transparent'}`,
                      fontSize:       13.5,
                      fontWeight:     active ? 700 : 500,
                      textDecoration: 'none',
                    }}
                  >
                    <span style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: active ? 1 : 0.7, flexShrink: 0 }}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User info + sign out */}
        <div className="px-5 py-4 space-y-3" style={{ borderTop: '1px solid #E8E3ED' }}>
          {/* User info */}
          {profile && (
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: isOwner ? '#5B2A86' : '#C9912B',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                }}
              >
                {(profile.full_name || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate" style={{ fontSize: 12.5, fontWeight: 600, color: '#1E1626' }}>
                  {profile.full_name || 'User'}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px',
                  color: isOwner ? '#5B2A86' : '#C9912B',
                }}>
                  {profile.role}
                </div>
              </div>
            </div>
          )}

          {/* Install PWA */}
          {deferredPrompt && !installed && (
            <button
              onClick={async () => {
                const prompt = deferredPrompt as any
                prompt.prompt()
                const result = await prompt.userChoice
                if (result.outcome === 'accepted') setInstalled(true)
                setDeferredPrompt(null)
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl transition-colors active:scale-95"
              style={{ background: '#EDE4F5', color: '#5B2A86', fontSize: 12.5, fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              <Download size={14} strokeWidth={2} />
              <span>Install App</span>
            </button>
          )}

          {/* Sign out */}
          <button
            onClick={signOut}
            className="flex items-center gap-2.5 w-full px-0 py-1 transition-colors"
            style={{ color: '#6B6373', fontSize: 12.5, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span className="flex items-center justify-center" style={{ width: 16 }}>
              <LogOut size={13} strokeWidth={2} />
            </span>
            <span>Sign Out</span>
          </button>
        </div>

      </aside>
    </>
  )
}
