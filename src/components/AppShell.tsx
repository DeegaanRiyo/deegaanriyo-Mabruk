'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import Sidebar   from './Sidebar'
import TopBar    from './TopBar'
import BottomNav from './BottomNav'

// Routes a cashier can access
const CASHIER_ROUTES = ['/sell', '/sales']

function canAccess(pathname: string, role: string): boolean {
  if (role === 'owner') return true
  // Cashier: only sell and sales history
  return CASHIER_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { profile, loading } = useAuth()

  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  // Receipt pages are full-screen — skip the shell
  if (pathname.includes('/receipt')) {
    return <>{children}</>
  }

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#FAF8FB' }}>
        <div className="text-center space-y-3">
          <div
            className="mx-auto flex items-center justify-center animate-pulse"
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#5B2A86', color: '#fff',
              fontSize: 22, fontWeight: 800,
            }}
          >
            M
          </div>
          <div style={{ fontSize: 12, color: '#6B6373' }}>Loading...</div>
        </div>
      </div>
    )
  }

  // Role-based route guard
  if (profile && !canAccess(pathname, profile.role)) {
    // Redirect cashier to /sell
    router.replace('/sell')
    return null
  }

  return (
    <div className="min-h-screen bg-background">

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main area — shifted right on desktop to clear sidebar */}
      <div className="md:ml-[240px] min-w-0 overflow-x-hidden">
        <TopBar onMenuOpen={() => setSidebarOpen(true)} />
        <main className="appshell-main">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
