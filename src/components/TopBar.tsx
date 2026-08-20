'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { useConnection } from '@/lib/connection'

const PRIMARY = 'var(--color-primary)'
const MUTED = 'var(--color-muted)'

const pages: Record<string, { title: string; subtitle: string }> = {
  '/':              { title: 'Mabruk Store',   subtitle: 'Dashboard' },
  '/products':      { title: 'Products',       subtitle: 'Catalog & stock' },
  '/sell':          { title: 'Sell',           subtitle: 'Point of sale' },
  '/sales':         { title: 'Sales',          subtitle: 'Transaction history' },
  '/finances':      { title: 'Finances',       subtitle: 'Revenue & expenses' },
  '/credits':       { title: 'Credits (Deni)', subtitle: 'Outstanding balances' },
  '/purchases':     { title: 'Purchase Orders', subtitle: 'Stock deliveries' },
  '/purchases/new': { title: 'Add Stock',      subtitle: 'Record delivery' },
  '/settings/users':   { title: 'User Management', subtitle: 'Manage staff accounts' },
  '/settings/profile': { title: 'My Profile',      subtitle: 'Account settings' },
}

interface TopBarProps {
  onMenuOpen: () => void
}

export default function TopBar({ onMenuOpen }: TopBarProps) {
  const pathname = usePathname()
  const { online, queuedSales, syncing } = useConnection()
  const { title, subtitle } = pages[pathname] ?? (
    pathname.startsWith('/sales/') ? { title: 'Receipt', subtitle: 'Sale details' } :
    pages['/']
  )

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-4 h-14"
      style={{
        background: '#ffffff',
        borderBottom: '1px solid #E8E3ED',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {/* Mobile */}
      <div className="flex md:hidden items-center gap-2 flex-1 min-w-0">
        {/* Hamburger */}
        <button
          onClick={onMenuOpen}
          className="flex items-center justify-center rounded-lg transition flex-shrink-0"
          style={{ width: 36, height: 36, background: 'none', border: 'none', cursor: 'pointer', color: '#6B6373' }}
          aria-label="Open menu"
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>

        {/* Store logo */}
        <div
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: PRIMARY, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, flexShrink: 0,
            border: '1.5px solid #E8E3ED',
          }}
        >
          M
        </div>

        {/* Title */}
        <div className="min-w-0">
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
            {title}
          </div>
          <div style={{ fontSize: 11, color: MUTED, lineHeight: 1, marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
      </div>

      {/* Mobile right */}
      <div className="flex md:hidden items-center gap-2 flex-shrink-0">
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-full"
          style={{ background: online ? '#E3F3EC' : '#FBE9E9' }}
        >
          {syncing ? (
            <div className="w-3 h-3 rounded-full border-[1.5px] border-t-transparent animate-spin" style={{ borderColor: '#B8791C transparent #B8791C #B8791C' }} />
          ) : (
            <div className={`w-1.5 h-1.5 rounded-full ${online ? 'animate-pulse' : ''}`} style={{ background: online ? '#2E7D5B' : '#B23A3A' }} />
          )}
          <span style={{ fontSize: 10, fontWeight: 600, color: online ? '#2E7D5B' : '#B23A3A' }}>
            {syncing ? 'Syncing' : online ? 'Live' : 'Offline'}
          </span>
          {queuedSales > 0 && (
            <span className="ml-0.5 px-1.5 rounded-full text-[9px] font-black" style={{ background: '#B8791C', color: '#fff' }}>
              {queuedSales}
            </span>
          )}
        </div>
        <Link
          href="/credits"
          className="flex items-center justify-center"
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#EDE4F5', color: PRIMARY,
            fontSize: 11, fontWeight: 700,
          }}
        >
          Cr
        </Link>
      </div>

      {/* Desktop */}
      <div className="hidden md:flex items-center gap-3">
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', lineHeight: 1.2 }}>{title}</div>
          <div style={{ fontSize: 11, color: MUTED, lineHeight: 1, marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-3">
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: online ? '#E3F3EC' : '#FBE9E9' }}
        >
          {syncing ? (
            <div className="w-3 h-3 rounded-full border-[1.5px] border-t-transparent animate-spin" style={{ borderColor: '#B8791C transparent #B8791C #B8791C' }} />
          ) : (
            <div className={`w-1.5 h-1.5 rounded-full ${online ? 'animate-pulse' : ''}`} style={{ background: online ? '#2E7D5B' : '#B23A3A' }} />
          )}
          <span style={{ fontSize: 11, fontWeight: 600, color: online ? '#2E7D5B' : '#B23A3A' }}>
            {syncing ? 'Syncing...' : online ? 'Live' : 'Offline'}
          </span>
          {queuedSales > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black" style={{ background: '#B8791C', color: '#fff' }}>
              {queuedSales} queued
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: MUTED }}>{today}</span>
      </div>
    </header>
  )
}
