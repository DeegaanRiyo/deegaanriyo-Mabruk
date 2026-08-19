'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isWeightProduct } from '@/lib/types'
import { fmt } from '@/lib/utils'
import Link from 'next/link'
import {
  Package,
  AlertTriangle,
  TrendingUp,
  ShoppingCart,
  Users,
  Wallet,
  BarChart3,
  Receipt,
} from 'lucide-react'

const PRIMARY = 'var(--color-primary)'
const MUTED = 'var(--color-muted)'
const CARD_SHADOW = 'var(--shadow-card)'

export default function DashboardPage() {
  const supabase = createClient()
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStock: 0,
    todaySales: 0,
    todayRevenue: 0,
    todayProfit: 0,
    pendingCredits: 0,
    pendingCreditAmount: 0,
  })
  const [lowStockItems, setLowStockItems] = useState<{ name: string; size: string | null; stock_qty: number; min_stock: number; unit_type: string; brand: string | null; pieces_per_unit: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [yesterdayRevenue, setYesterdayRevenue] = useState(0)

  useEffect(() => {
    async function load() {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString()

      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayISO = yesterday.toISOString()

      const results = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.rpc('get_low_stock_products'),
        supabase.from('sales').select('id, total, paid_amount').gte('created_at', todayISO),
        supabase.from('sale_items').select('quantity, unit_price, buy_price, line_total, sales!inner(created_at)').gte('sales.created_at', todayISO),
        supabase.from('credits').select('amount, paid').eq('is_settled', false),
        supabase.from('sales').select('total').gte('created_at', yesterdayISO).lt('created_at', todayISO),
      ])

      const queryError = results.find(r => r.error)?.error
      if (queryError) { setError('Failed to load dashboard: ' + queryError.message); setLoading(false); return }

      const [
        { count: totalProducts },
        { data: lowStockData },
        { data: todaySalesData },
        { data: todayItemsData },
        { data: creditsData },
        { data: yesterdaySalesData },
      ] = results
      setYesterdayRevenue((yesterdaySalesData ?? []).reduce((s, r) => s + Number(r.total), 0))

      const todayRevenue = (todaySalesData ?? []).reduce((s, r) => s + Number(r.total), 0)
      const todayProfit = (todayItemsData ?? []).reduce((s, r) => s + (Number(r.unit_price) - Number(r.buy_price)) * Number(r.quantity), 0)
      const pendingCreditAmount = (creditsData ?? []).reduce((s, r) => s + (Number(r.amount) - Number(r.paid)), 0)

      setStats({
        totalProducts: totalProducts ?? 0,
        lowStock: (lowStockData ?? []).length,
        todaySales: (todaySalesData ?? []).length,
        todayRevenue,
        todayProfit,
        pendingCredits: (creditsData ?? []).length,
        pendingCreditAmount,
      })
      setLowStockItems((lowStockData ?? []) as typeof lowStockItems)
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line

  if (loading) {
    return (
      <div className="p-6 text-center" style={{ color: MUTED }}>
        <div className="animate-pulse space-y-3">
          <div className="h-10 bg-border/50 rounded-xl" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-24 bg-border/50 rounded-xl" />
            <div className="h-24 bg-border/50 rounded-xl" />
            <div className="h-24 bg-border/50 rounded-xl" />
            <div className="h-24 bg-border/50 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-5 space-y-4">

      {/* Error banner */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: '#FEF2F2', color: '#B23A3A', border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED }}>
            Dashboard
          </p>
          <p style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
        </div>
        <Link
          href="/sell"
          className="text-[13px] font-semibold flex-shrink-0 transition-colors active:scale-95"
          style={{ background: PRIMARY, color: '#fff', borderRadius: 8, padding: '6px 14px', textDecoration: 'none' }}
        >
          + New Sale
        </Link>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/sell"
          className="rounded-xl px-3 py-3 flex items-center gap-2.5 active:scale-[0.98] transition"
          style={{ background: '#fff', boxShadow: CARD_SHADOW, textDecoration: 'none' }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#EDE4F5' }}>
            <ShoppingCart size={15} strokeWidth={2} style={{ color: PRIMARY }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>New Sale</p>
            <p style={{ fontSize: 11, color: MUTED }}>POS checkout</p>
          </div>
        </Link>
        <Link
          href="/stock"
          className="rounded-xl px-3 py-3 flex items-center gap-2.5 active:scale-[0.98] transition"
          style={{ background: '#fff', boxShadow: CARD_SHADOW, textDecoration: 'none' }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#FBF0DC' }}>
            <Package size={15} strokeWidth={2} style={{ color: '#B8791C' }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Stock In</p>
            <p style={{ fontSize: 11, color: MUTED }}>Record delivery</p>
          </div>
        </Link>
      </div>

      {/* Stat cards with colored left borders */}
      <div className="grid grid-cols-2 gap-2">
        {/* Today's Sales */}
        <Link href="/sales" className="rounded-xl bg-white overflow-hidden flex" style={{ boxShadow: CARD_SHADOW, textDecoration: 'none' }}>
          <div className="w-1" style={{ background: PRIMARY }} />
          <div className="flex-1 px-3 py-3">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} strokeWidth={2.5} style={{ color: MUTED }} />
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: MUTED }}>Sales Today</p>
            </div>
            <p className="tabnum" style={{ fontSize: 22, fontWeight: 800, color: '#111827', lineHeight: 1, marginTop: 6 }}>
              {fmt(stats.todayRevenue)}
            </p>
            <p style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
              {stats.todaySales} transactions
              {yesterdayRevenue > 0 && (
                <span style={{
                  marginLeft: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  color: stats.todayRevenue >= yesterdayRevenue ? '#2E7D5B' : '#B23A3A',
                }}>
                  {stats.todayRevenue >= yesterdayRevenue ? '↑' : '↓'} vs yesterday
                </span>
              )}
            </p>
          </div>
        </Link>

        {/* Today's Profit */}
        <div className="rounded-xl bg-white overflow-hidden flex" style={{ boxShadow: CARD_SHADOW }}>
          <div className="w-1" style={{ background: '#2E7D5B' }} />
          <div className="flex-1 px-3 py-3">
            <div className="flex items-center gap-1.5">
              <Wallet size={12} strokeWidth={2.5} style={{ color: MUTED }} />
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: MUTED }}>Profit</p>
            </div>
            <p className="tabnum" style={{ fontSize: 22, fontWeight: 800, color: '#2E7D5B', lineHeight: 1, marginTop: 6 }}>
              {fmt(stats.todayProfit)}
            </p>
            <p style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>gross margin</p>
          </div>
        </div>

        {/* Products */}
        <Link href="/products" className="rounded-xl bg-white overflow-hidden flex" style={{ boxShadow: CARD_SHADOW, textDecoration: 'none' }}>
          <div className="w-1" style={{ background: '#B8791C' }} />
          <div className="flex-1 px-3 py-3">
            <div className="flex items-center gap-1.5">
              <Package size={12} strokeWidth={2.5} style={{ color: MUTED }} />
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: MUTED }}>Products</p>
            </div>
            <p className="tabnum" style={{ fontSize: 26, fontWeight: 800, color: '#111827', lineHeight: 1, marginTop: 6 }}>
              {stats.totalProducts}
            </p>
            <p style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>in catalog</p>
          </div>
        </Link>

        {/* Credit Owed */}
        <Link href="/credits" className="rounded-xl bg-white overflow-hidden flex" style={{ boxShadow: CARD_SHADOW, textDecoration: 'none' }}>
          <div className="w-1" style={{ background: '#B23A3A' }} />
          <div className="flex-1 px-3 py-3">
            <div className="flex items-center gap-1.5">
              <Users size={12} strokeWidth={2.5} style={{ color: MUTED }} />
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: MUTED }}>Credit Owed</p>
            </div>
            <p className="tabnum" style={{ fontSize: 18, fontWeight: 800, color: '#B23A3A', lineHeight: 1, marginTop: 6 }}>
              {fmt(stats.pendingCreditAmount)}
            </p>
            <p style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{stats.pendingCredits} people</p>
          </div>
        </Link>
      </div>

      {/* Low stock alert */}
      {stats.lowStock > 0 && (
        <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: CARD_SHADOW, border: '1px solid #FECACA' }}>
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={13} strokeWidth={2.5} style={{ color: '#B23A3A' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#B23A3A' }}>Low Stock ({stats.lowStock})</span>
            </div>
            <Link href="/products" style={{ fontSize: 12, fontWeight: 600, color: '#B23A3A', textDecoration: 'none' }}>View all</Link>
          </div>
          {lowStockItems.slice(0, 5).map((item, i) => (
            <div key={item.name} className="px-4 py-2.5 flex items-center justify-between"
              style={{ borderBottom: i < Math.min(lowStockItems.length, 5) - 1 ? '1px solid #FEF2F2' : 'none' }}>
              <span style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>
                {item.brand && <span style={{ color: '#6B6373', fontWeight: 400 }}>{item.brand} </span>}
                {item.name}
                {item.size && <span style={{ color: '#6B6373', fontWeight: 400 }}> {item.size}</span>}
              </span>
              <span className="tabnum" style={{ fontSize: 13, fontWeight: 700, color: '#B23A3A' }}>
                {item.stock_qty} {isWeightProduct(item) ? 'kg' : 'pcs'} left
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/finances"
          className="rounded-xl bg-white px-3 py-3 flex items-center gap-2.5 active:scale-[0.98] transition"
          style={{ boxShadow: CARD_SHADOW, textDecoration: 'none' }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#EDE4F5' }}>
            <BarChart3 size={15} strokeWidth={2} style={{ color: PRIMARY }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Finances</p>
            <p style={{ fontSize: 11, color: MUTED }}>Full breakdown</p>
          </div>
        </Link>
        <Link
          href="/credits"
          className="rounded-xl bg-white px-3 py-3 flex items-center gap-2.5 active:scale-[0.98] transition"
          style={{ boxShadow: CARD_SHADOW, textDecoration: 'none' }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#FBE9E9' }}>
            <Receipt size={15} strokeWidth={2} style={{ color: '#B23A3A' }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Credits</p>
            <p style={{ fontSize: 11, color: MUTED }}>{stats.pendingCredits > 0 ? `${stats.pendingCredits} pending` : 'All clear'}</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
