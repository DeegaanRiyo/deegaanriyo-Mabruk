'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt, fmtDate } from '@/lib/utils'
import { Expense } from '@/lib/types'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Wallet, Users, Plus, Truck, BarChart2, Trash2, Package } from 'lucide-react'

const SHADOW = 'var(--shadow-card)'

function StatCard({
  accent, bg, labelColor, valueColor, icon, label, value, sub, link, linkLabel,
}: {
  accent: string
  bg: string
  labelColor: string
  valueColor: string
  icon: React.ReactNode
  label: string
  value: number
  sub?: React.ReactNode
  link?: string
  linkLabel?: string
}) {
  return (
    <div className="rounded-xl overflow-hidden flex" style={{ background: bg, boxShadow: SHADOW }}>
      <div className="w-1.5 flex-shrink-0" style={{ background: accent }} />
      <div className="flex-1 px-3 py-3 min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: labelColor }}>
          <span style={{ color: accent }}>{icon}</span>
          {label}
        </div>
        <div className="text-xl font-bold tabnum" style={{ color: valueColor }}>
          KES {fmt(value)}
        </div>
        {sub}
        {link && linkLabel && (
          <Link href={link} className="text-xs font-medium mt-1 inline-block" style={{ color: accent }}>
            {linkLabel} →
          </Link>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B6373', whiteSpace: 'nowrap' }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: '#E8E3ED' }} />
    </div>
  )
}

type Stats = {
  revenue: number
  totalSales: number
  cashCollected: number
  mpesaCollected: number
  cogsSold: number
  grossProfit: number
  expenses: number
  netProfit: number
  creditOwed: number
  supplierDebt: number
  cogsPurchased: number
  stockValue: number
  stockItems: number
}

const EMPTY: Stats = {
  revenue: 0, totalSales: 0, cashCollected: 0, mpesaCollected: 0,
  cogsSold: 0, grossProfit: 0,
  expenses: 0, netProfit: 0,
  creditOwed: 0, supplierDebt: 0, cogsPurchased: 0,
  stockValue: 0, stockItems: 0,
}

type Period = 'today' | 'week' | 'month' | 'quarter' | 'custom'

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function FinancesPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('today')

  const today = toDateInput(new Date())
  const [customFrom, setCustomFrom] = useState(today)
  const [customTo,   setCustomTo]   = useState(today)
  const [showCustom, setShowCustom] = useState(false)

  const [stats, setStats] = useState<Stats>(EMPTY)
  const [dailyData, setDailyData] = useState<{ label: string; revenue: number; profit: number }[]>([])
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', category: '' })
  const [saving, setSaving] = useState(false)
  const [expenseList, setExpenseList] = useState<Expense[]>([])
  const [showExpenses, setShowExpenses] = useState(false)

  useEffect(() => {
    if (period !== 'custom') loadStats()
  }, [period]) // eslint-disable-line

  function getStartISO(): string {
    const start = new Date()
    if (period === 'today')   { start.setHours(0, 0, 0, 0); return start.toISOString() }
    if (period === 'week')    { start.setDate(start.getDate() - 7); return start.toISOString() }
    if (period === 'month')   { start.setDate(1); start.setHours(0, 0, 0, 0); return start.toISOString() }
    if (period === 'quarter') { start.setMonth(start.getMonth() - 3); start.setHours(0, 0, 0, 0); return start.toISOString() }
    return new Date(customFrom + 'T00:00:00').toISOString()
  }

  function getEndISO(): string | null {
    if (period !== 'custom') return null
    return new Date(customTo + 'T23:59:59').toISOString()
  }

  async function loadStats() {
    setLoading(true)
    const startISO = getStartISO()
    const endISO   = getEndISO()

    // Period-filtered sales (created_at needed for chart grouping)
    let salesQ = supabase
      .from('sales')
      .select('id, total, paid_amount, cash_amount, mpesa_amount, method, created_at')
      .gte('created_at', startISO)
    if (endISO) salesQ = salesQ.lte('created_at', endISO)

    let siQ = supabase
      .from('sale_items')
      .select('quantity, unit_price, buy_price, line_total, sales!inner(created_at)')
      .gte('sales.created_at', startISO)
    let exQ = supabase.from('expenses').select('*').gte('created_at', startISO).order('created_at', { ascending: false })
    let ppQ = supabase.from('purchase_orders').select('total_amount').gte('created_at', startISO)
    if (endISO) {
      siQ = siQ.lte('sales.created_at', endISO)
      exQ = exQ.lte('created_at', endISO)
      ppQ = ppQ.lte('created_at', endISO)
    }

    const [
      { data: salesRows },
      { data: saleItems },
      { data: expenseRows },
      { data: credits },
      { data: purchaseOrders },
      { data: periodPurchases },
      { data: stockData },
    ] = await Promise.all([
      salesQ,
      siQ,
      exQ,
      supabase.from('credits').select('amount, paid').eq('is_settled', false),
      supabase.from('purchase_orders').select('total_amount, paid_amount'),
      ppQ,
      supabase.from('products').select('stock_qty, buy_price').eq('is_active', true).gt('stock_qty', 0),
    ])

    type R = Record<string, unknown>
    const sales         = (salesRows ?? []) as R[]
    const totalSales    = sales.length
    const revenue       = sales.reduce((s: number, r) => s + Number(r.total), 0)
    const cashCollected = sales.reduce((s: number, r) => s + Number(r.cash_amount ?? 0), 0)
    const mpesaCollected= sales.reduce((s: number, r) => s + Number(r.mpesa_amount ?? 0), 0)

    const cogsSold     = ((saleItems       ?? []) as R[]).reduce((s: number, r) => s + Number(r.buy_price) * Number(r.quantity), 0)
    const grossProfit  = revenue - cogsSold
    const expRows      = (expenseRows ?? []) as Expense[]
    const expenses     = expRows.reduce((s: number, r) => s + Number(r.amount), 0)
    setExpenseList(expRows)
    const creditOwed   = ((credits         ?? []) as R[]).reduce((s: number, r) => s + Math.max(0, Number(r.amount) - Number(r.paid)), 0)
    const netProfit    = grossProfit - expenses
    const supplierDebt = ((purchaseOrders  ?? []) as R[]).reduce((s: number, r) => s + Math.max(0, Number(r.total_amount) - Number(r.paid_amount)), 0)
    const cogsPurchased= ((periodPurchases ?? []) as R[]).reduce((s: number, r) => s + Number(r.total_amount), 0)
    const stockRows    = (stockData ?? []) as R[]
    const stockValue   = stockRows.reduce((s: number, r) => s + Number(r.stock_qty) * Number(r.buy_price), 0)
    const stockItems   = stockRows.length

    setStats({ revenue, totalSales, cashCollected, mpesaCollected, cogsSold, grossProfit, expenses, netProfit, creditOwed, supplierDebt, cogsPurchased, stockValue, stockItems })

    // Build chart from already-fetched data.
    // For 'today' the stats window is < 1 day, so widen the chart to 7 days
    // for context (requires a small extra fetch). All other periods reuse
    // salesRows / saleItems — no extra round-trips.
    let chartSales  = (salesRows ?? []) as R[]
    let chartItems  = (saleItems  ?? []) as R[]
    let chartStart  = new Date(startISO)
    let chartEnd    = endISO ? new Date(endISO) : new Date()

    if (period === 'today') {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 6)
      weekAgo.setHours(0, 0, 0, 0)
      chartStart = weekAgo
      const [{ data: ws }, { data: wi }] = await Promise.all([
        supabase.from('sales').select('total, created_at').gte('created_at', weekAgo.toISOString()),
        supabase.from('sale_items').select('quantity, unit_price, buy_price, sales!inner(created_at)').gte('sales.created_at', weekAgo.toISOString()),
      ])
      chartSales = (ws ?? []) as R[]
      chartItems = (wi ?? []) as R[]
    }

    const msPerDay  = 86_400_000
    const totalDays = Math.max(1, Math.ceil((chartEnd.getTime() - chartStart.getTime()) / msPerDay) + 1)
    // >14 days: switch to weekly bars so the chart stays readable on mobile.
    // The week period (7 days) always stays daily; month (15-31 days) goes weekly.
    const useWeekly = totalDays > 14
    const dayNames  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    const days: { label: string; revenue: number; profit: number }[] = []

    if (!useWeekly) {
      // Daily bars — one per day in the range
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(chartStart)
        d.setDate(d.getDate() + i)
        const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0)
        const dayEnd   = new Date(d); dayEnd.setHours(23, 59, 59, 999)
        const dayRev = chartSales
          .filter(s => { const t = new Date(s.created_at as string); return t >= dayStart && t <= dayEnd })
          .reduce((s: number, r) => s + Number(r.total), 0)
        const dayProfit = chartItems
          .filter(s => {
            const ca = s.sales as Record<string, string> | undefined
            if (!ca?.created_at) return false
            const t = new Date(ca.created_at)
            return t >= dayStart && t <= dayEnd
          })
          .reduce((s: number, r) => s + (Number(r.unit_price) - Number(r.buy_price)) * Number(r.quantity), 0)
        const label = totalDays <= 7
          ? dayNames[d.getDay()]
          : `${d.getDate()}/${d.getMonth() + 1}`
        days.push({ label, revenue: dayRev, profit: dayProfit })
      }
    } else {
      // Weekly bars — Monday-aligned buckets
      const firstMon = new Date(chartStart)
      const dow = firstMon.getDay()
      firstMon.setDate(firstMon.getDate() - (dow === 0 ? 6 : dow - 1))
      firstMon.setHours(0, 0, 0, 0)
      const weekCount = Math.ceil((chartEnd.getTime() - firstMon.getTime()) / (7 * msPerDay))
      for (let i = 0; i < weekCount; i++) {
        const wStart = new Date(firstMon); wStart.setDate(wStart.getDate() + i * 7)
        const wEnd   = new Date(wStart);   wEnd.setDate(wEnd.getDate() + 6); wEnd.setHours(23, 59, 59, 999)
        const wRev = chartSales
          .filter(s => { const t = new Date(s.created_at as string); return t >= wStart && t <= wEnd })
          .reduce((s: number, r) => s + Number(r.total), 0)
        const wProfit = chartItems
          .filter(s => {
            const ca = s.sales as Record<string, string> | undefined
            if (!ca?.created_at) return false
            const t = new Date(ca.created_at)
            return t >= wStart && t <= wEnd
          })
          .reduce((s: number, r) => s + (Number(r.unit_price) - Number(r.buy_price)) * Number(r.quantity), 0)
        days.push({ label: `Wk${i + 1}`, revenue: wRev, profit: wProfit })
      }
    }
    setDailyData(days)
    setLoading(false)
  }

  async function handleAddExpense() {
    if (!expenseForm.description || !expenseForm.amount) return
    setSaving(true)
    const { error } = await supabase.from('expenses').insert({
      description: expenseForm.description.trim(),
      amount: parseFloat(expenseForm.amount),
      category: expenseForm.category.trim() || null,
    })
    setSaving(false)
    if (error) { alert('Failed to save expense: ' + error.message); return }
    setExpenseForm({ description: '', amount: '', category: '' })
    setShowExpenseForm(false)
    loadStats()
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { alert('Failed to delete: ' + error.message); return }
    loadStats()
  }

  function exportCSV() {
    const rows = [
      ['Metric', 'Amount (KES)'],
      ['Revenue', String(stats.revenue)],
      ['Cash Collected', String(stats.cashCollected)],
      ['M-Pesa Collected', String(stats.mpesaCollected)],
      ['Cost of Goods Sold', String(stats.cogsSold)],
      ['Gross Profit', String(stats.grossProfit)],
      ['Expenses', String(stats.expenses)],
      ['Net Profit', String(stats.netProfit)],
      ['Stock Purchased', String(stats.cogsPurchased)],
      ['Credit Owed by Customers', String(stats.creditOwed)],
      ['Owed to Suppliers', String(stats.supplierDebt)],
      [],
      ['Expense Details'],
      ['Date', 'Description', 'Category', 'Amount'],
      ...expenseList.map(e => [fmtDate(e.created_at), e.description, e.category || '', String(e.amount)]),
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mabruk-finances-${period}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const marginPct = stats.revenue > 0 ? ((stats.grossProfit / stats.revenue) * 100).toFixed(1) : '0.0'
  const totalCollected = stats.cashCollected + stats.mpesaCollected

  return (
    <div className="p-4 space-y-4 max-w-[1008px] mx-auto">

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold" style={{ color: '#1E1626' }}>Finances</h1>
        {!loading && (
          <button
            onClick={exportCSV}
            className="text-xs font-bold px-3 py-1.5 rounded-lg transition active:scale-95"
            style={{ background: '#F1F3F5', color: '#374151', border: '1px solid #E8E3ED' }}
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Period tabs */}
      <div className="flex flex-wrap gap-2 items-center">
        {([
          ['today',   'Today'],
          ['week',    'This Week'],
          ['month',   'This Month'],
          ['quarter', '3 Months'],
        ] as [Period, string][]).map(([p, label]) => (
          <button
            key={p}
            onClick={() => { setPeriod(p); setShowCustom(false) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition active:scale-95 flex-shrink-0"
            style={{
              background: period === p ? '#EDE4F5' : '#fff',
              color:      period === p ? '#5B2A86' : '#6B6373',
              border:     `1.5px solid ${period === p ? '#5B2A86' : '#E8E3ED'}`,
            }}
          >
            {label}
          </button>
        ))}

        <button
          onClick={() => { setPeriod('custom'); setShowCustom(v => !v) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition active:scale-95 flex-shrink-0"
          style={{
            background: period === 'custom' ? '#EDE4F5' : '#fff',
            color:      period === 'custom' ? '#5B2A86' : '#6B6373',
            border:     `1.5px solid ${period === 'custom' ? '#5B2A86' : '#E8E3ED'}`,
          }}
        >
          Custom range
          <span style={{ fontSize: 10, opacity: 0.7 }}>{showCustom ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* Custom date range picker */}
      {period === 'custom' && showCustom && (
        <div className="flex flex-wrap items-end gap-3 bg-white rounded-xl px-4 py-3" style={{ boxShadow: SHADOW }}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#6B6373' }}>From</div>
            <input type="date" value={customFrom} max={customTo}
              onChange={e => setCustomFrom(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border border-[#E8E3ED] focus:outline-none focus:ring-2 focus:ring-[#5B2A86]/20 focus:border-[#5B2A86]"
              style={{ colorScheme: 'light' }} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#6B6373' }}>To</div>
            <input type="date" value={customTo} min={customFrom} max={today}
              onChange={e => setCustomTo(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border border-[#E8E3ED] focus:outline-none focus:ring-2 focus:ring-[#5B2A86]/20 focus:border-[#5B2A86]"
              style={{ colorScheme: 'light' }} />
          </div>
          <button onClick={() => { setShowCustom(false); loadStats() }}
            className="px-4 py-2 rounded-lg text-sm font-bold transition active:scale-95"
            style={{ background: '#5B2A86', color: '#fff' }}>
            Apply
          </button>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-[#E8E3ED] rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* ── MONEY IN (Cash Register) ── */}
          <SectionLabel>Money Collected</SectionLabel>

          {/* Cash vs M-Pesa breakdown */}
          <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: SHADOW }}>
            {/* Header row */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #E8E3ED' }}>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6B6373' }}>
                  Total Collected · {stats.totalSales} sale{stats.totalSales !== 1 ? 's' : ''}
                </div>
                <div className="text-2xl font-bold tabnum" style={{ color: '#1E1626' }}>
                  KES {fmt(totalCollected)}
                </div>
              </div>
              {stats.creditOwed > 0 && (
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#B8791C' }}>Uncollected (Credit)</div>
                  <div className="text-base font-bold tabnum" style={{ color: '#B8791C' }}>KES {fmt(stats.creditOwed)}</div>
                </div>
              )}
            </div>
            {stats.revenue > 0 && stats.revenue !== totalCollected && (
              <div className="px-4 pb-3">
                <div className="text-[10px] rounded-lg px-3 py-1.5" style={{ background: '#FFFBEB', color: '#92400E' }}>
                  Collected = cash + M-Pesa received. Revenue includes credit sales not yet paid.
                </div>
              </div>
            )}

            {/* Cash / M-Pesa bars */}
            <div className="px-4 py-3 space-y-2">
              {/* Cash */}
              <div className="flex items-center gap-3">
                <div className="w-16 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#5B2A86' }}>Cash</div>
                <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: '#F0ECF5' }}>
                  <div
                    className="h-full rounded-full flex items-center justify-end px-2"
                    style={{
                      background: '#5B2A86',
                      width: totalCollected > 0 ? `${Math.max(2, (stats.cashCollected / totalCollected) * 100)}%` : '0%',
                      minWidth: stats.cashCollected > 0 ? 60 : 0,
                      transition: 'width 0.4s ease',
                    }}
                  >
                    {stats.cashCollected > 0 && (
                      <span className="text-[10px] font-bold tabnum text-white whitespace-nowrap">{fmt(stats.cashCollected)}</span>
                    )}
                  </div>
                </div>
                <div className="w-20 text-right text-xs font-bold tabnum" style={{ color: '#5B2A86' }}>
                  KES {fmt(stats.cashCollected)}
                </div>
              </div>

              {/* M-Pesa */}
              <div className="flex items-center gap-3">
                <div className="w-16 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#2E7D5B' }}>M-Pesa</div>
                <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: '#EBF7F2' }}>
                  <div
                    className="h-full rounded-full flex items-center justify-end px-2"
                    style={{
                      background: '#2E7D5B',
                      width: totalCollected > 0 ? `${Math.max(2, (stats.mpesaCollected / totalCollected) * 100)}%` : '0%',
                      minWidth: stats.mpesaCollected > 0 ? 60 : 0,
                      transition: 'width 0.4s ease',
                    }}
                  >
                    {stats.mpesaCollected > 0 && (
                      <span className="text-[10px] font-bold tabnum text-white whitespace-nowrap">{fmt(stats.mpesaCollected)}</span>
                    )}
                  </div>
                </div>
                <div className="w-20 text-right text-xs font-bold tabnum" style={{ color: '#2E7D5B' }}>
                  KES {fmt(stats.mpesaCollected)}
                </div>
              </div>
            </div>
          </div>

          {/* ── TREND CHART ── */}
          {dailyData.length > 0 && (() => {
            const maxVal = Math.max(...dailyData.map(d => d.revenue), 1)
            // Infer granularity from bar labels (weekly bars are labelled "Wk1", "Wk2"…)
            const chartIsWeekly = dailyData[0]?.label.startsWith('Wk') ?? false
            const chartLabel =
              period === 'today' || period === 'week' ? 'Last 7 Days' :
              period === 'month'   ? (chartIsWeekly ? 'This Month (Weekly)' : 'This Month (Daily)') :
              period === 'quarter' ? 'Last 3 Months (Weekly)' :
              chartIsWeekly ? 'Custom Range (Weekly)' : 'Custom Range (Daily)'
            return (
              <>
                <SectionLabel>{chartLabel}</SectionLabel>
                <div className="bg-white rounded-xl p-4" style={{ boxShadow: SHADOW }}>
                  <div className="flex items-end gap-1.5" style={{ height: 120 }}>
                    {dailyData.map((d, i) => {
                      const h = maxVal > 0 ? Math.max(4, (d.revenue / maxVal) * 100) : 4
                      const isToday = i === dailyData.length - 1
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          {d.revenue > 0 && (
                            <div className="text-[8px] font-bold tabnum" style={{ color: '#5B2A86' }}>
                              {d.revenue >= 1000 ? `${(d.revenue / 1000).toFixed(0)}k` : fmt(d.revenue)}
                            </div>
                          )}
                          <div className="w-full flex flex-col items-center" style={{ flex: 1, justifyContent: 'flex-end' }}>
                            <div
                              className="w-full rounded-t-md transition-all"
                              style={{
                                height: `${h}%`,
                                minHeight: 4,
                                background: isToday
                                  ? 'linear-gradient(180deg, #5B2A86 0%, #7C3EB0 100%)'
                                  : d.revenue > 0 ? '#C9A8E0' : '#E8E3ED',
                              }}
                            />
                          </div>
                          <div
                            className="text-[9px] font-bold"
                            style={{ color: isToday ? '#5B2A86' : '#6B6373' }}
                          >
                            {d.label}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Legend */}
                  <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #E8E3ED' }}>
                    <div className="text-[10px]" style={{ color: '#6B6373' }}>
                      Total: <span className="font-bold tabnum" style={{ color: '#5B2A86' }}>KES {fmt(dailyData.reduce((s, d) => s + d.revenue, 0))}</span>
                    </div>
                    <div className="text-[10px]" style={{ color: '#6B6373' }}>
                      Avg: <span className="font-bold tabnum" style={{ color: '#5B2A86' }}>KES {fmt(Math.round(dailyData.reduce((s, d) => s + d.revenue, 0) / Math.max(dailyData.length, 1)))}</span>/{dailyData.length > 14 ? 'wk' : 'day'}
                    </div>
                  </div>
                </div>
              </>
            )
          })()}

          {/* ── PROFITABILITY ── */}
          <SectionLabel>Profitability</SectionLabel>

          <div className="grid grid-cols-2 gap-3">
            {/* Revenue */}
            <StatCard
              accent="#5B2A86" bg="#F6F0FC"
              labelColor="#7C3EB0" valueColor="#3B1A5A"
              icon={<TrendingUp size={13} />}
              label="Revenue (Sales Total)"
              value={stats.revenue}
              sub={
                <div className="text-[10px] mt-0.5" style={{ color: '#7C3EB0' }}>
                  What customers owe for goods sold
                </div>
              }
            />
            {/* Cost of Goods Sold */}
            <StatCard
              accent="#374151" bg="#F1F3F5"
              labelColor="#4B5563" valueColor="#1F2937"
              icon={<TrendingDown size={13} />}
              label="Cost of Goods Sold"
              value={stats.cogsSold}
              sub={
                <div className="text-[10px] mt-0.5" style={{ color: '#4B5563' }}>
                  What you paid for items sold
                </div>
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Gross Profit */}
            <StatCard
              accent={stats.grossProfit >= 0 ? '#2E7D5B' : '#B23A3A'}
              bg={stats.grossProfit >= 0 ? '#EBF7F2' : '#FEF2F2'}
              labelColor={stats.grossProfit >= 0 ? '#2E7D5B' : '#991B1B'}
              valueColor={stats.grossProfit >= 0 ? '#1A4D37' : '#B23A3A'}
              icon={<BarChart2 size={13} />}
              label="Gross Profit"
              value={stats.grossProfit}
              sub={
                <div className="text-[10px] mt-0.5 tabnum font-semibold" style={{ color: stats.grossProfit >= 0 ? '#2E7D5B' : '#991B1B' }}>
                  {marginPct}% margin = Revenue − COGS
                </div>
              }
            />
            {/* Net Profit */}
            <StatCard
              accent={stats.netProfit >= 0 ? '#2E7D5B' : '#B23A3A'}
              bg={stats.netProfit >= 0 ? '#EBF7F2' : '#FEF2F2'}
              labelColor={stats.netProfit >= 0 ? '#2E7D5B' : '#991B1B'}
              valueColor={stats.netProfit >= 0 ? '#1A4D37' : '#B23A3A'}
              icon={<Wallet size={13} />}
              label="Net Profit"
              value={stats.netProfit}
              sub={
                <div className="text-[10px] mt-0.5 font-semibold" style={{ color: stats.netProfit >= 0 ? '#2E7D5B' : '#991B1B' }}>
                  Gross Profit − KES {fmt(stats.expenses)} expenses
                </div>
              }
            />
          </div>

          {/* ── HOW THE MONEY FLOWS — visual summary ── */}
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: SHADOW }}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#6B6373' }}>
              How your money flows
            </div>
            <div className="space-y-1.5" style={{ fontSize: 13 }}>
              <div className="flex justify-between">
                <span style={{ color: '#374151' }}>Revenue (sales total)</span>
                <span className="font-bold tabnum" style={{ color: '#5B2A86' }}>KES {fmt(stats.revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#374151' }}>− Cost of goods sold</span>
                <span className="font-bold tabnum" style={{ color: '#B23A3A' }}>KES {fmt(stats.cogsSold)}</span>
              </div>
              <div style={{ height: 1, background: '#E8E3ED', margin: '4px 0' }} />
              <div className="flex justify-between">
                <span className="font-semibold" style={{ color: '#2E7D5B' }}>= Gross Profit</span>
                <span className="font-bold tabnum" style={{ color: '#2E7D5B' }}>KES {fmt(stats.grossProfit)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#374151' }}>− Expenses</span>
                <span className="font-bold tabnum" style={{ color: '#B23A3A' }}>KES {fmt(stats.expenses)}</span>
              </div>
              <div style={{ height: 1, background: '#E8E3ED', margin: '4px 0' }} />
              <div className="flex justify-between">
                <span className="font-bold" style={{ color: stats.netProfit >= 0 ? '#1A4D37' : '#B23A3A' }}>= Net Profit</span>
                <span className="font-bold tabnum text-base" style={{ color: stats.netProfit >= 0 ? '#1A4D37' : '#B23A3A' }}>
                  KES {fmt(stats.netProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* ── STOCK PURCHASES ── */}
          <SectionLabel>Stock &amp; Purchases</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              accent="#374151" bg="#F1F3F5"
              labelColor="#4B5563" valueColor="#1F2937"
              icon={<TrendingDown size={13} />}
              label="Purchased This Period"
              value={stats.cogsPurchased}
              sub={
                <div className="text-[10px] mt-0.5" style={{ color: '#4B5563' }}>
                  Total spent on stock from suppliers
                </div>
              }
              link="/purchases" linkLabel="View orders"
            />
            <StatCard
              accent="#5B2A86" bg="#F6F0FC"
              labelColor="#7C3EB0" valueColor="#3B1A5A"
              icon={<Package size={13} />}
              label="Current Stock Value"
              value={stats.stockValue}
              sub={
                <div className="text-[10px] mt-0.5" style={{ color: '#7C3EB0' }}>
                  {stats.stockItems} products at cost price
                </div>
              }
              link="/products" linkLabel="View products"
            />
          </div>

          {/* ── OBLIGATIONS ── */}
          <SectionLabel>Outstanding Obligations</SectionLabel>

          <div className="grid grid-cols-2 gap-3">
            <StatCard
              accent="#B8791C" bg="#FFFBEB"
              labelColor="#92400E" valueColor="#78350F"
              icon={<Users size={13} />}
              label="Customers Owe You"
              value={stats.creditOwed}
              sub={
                <div className="text-[10px] mt-0.5" style={{ color: '#92400E' }}>
                  Unpaid credit from sales
                </div>
              }
              link="/credits" linkLabel="View credits"
            />
            <StatCard
              accent="#B23A3A" bg="#FEF2F2"
              labelColor="#991B1B" valueColor="#7F1D1D"
              icon={<Truck size={13} />}
              label="You Owe Suppliers"
              value={stats.supplierDebt}
              sub={
                <div className="text-[10px] mt-0.5" style={{ color: '#991B1B' }}>
                  Unpaid stock purchases
                </div>
              }
              link="/purchases" linkLabel="View orders"
            />
          </div>

          {/* ── EXPENSES ── */}
          <SectionLabel>Expenses</SectionLabel>

          <div className="rounded-xl overflow-hidden flex" style={{ background: '#FEF2F2', boxShadow: SHADOW }}>
            <div className="w-1.5 flex-shrink-0" style={{ background: '#B23A3A' }} />
            <div className="flex-1 px-3 py-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#991B1B' }}>
                  <TrendingDown size={13} color="#B23A3A" /> Expenses This Period
                </div>
                <div className="text-xl font-bold tabnum" style={{ color: '#7F1D1D' }}>KES {fmt(stats.expenses)}</div>
              </div>
              <button
                onClick={() => setShowExpenseForm(!showExpenseForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95"
                style={{ background: '#EDE4F5', color: '#5B2A86', border: '1.5px solid #C9A8E0' }}
              >
                <Plus size={13} /> Add
              </button>
            </div>
          </div>

          {showExpenseForm && (
            <div className="bg-white rounded-xl p-4 space-y-3" style={{ boxShadow: SHADOW }}>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: '#6B6373' }}>Description</label>
                <input
                  placeholder="e.g. Transport to supplier"
                  value={expenseForm.description}
                  onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#FAF8FB] border-[1.5px] border-[#E8E3ED] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: '#6B6373' }}>Amount (KES)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#FAF8FB] border-[1.5px] border-[#E8E3ED] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: '#6B6373' }}>Category</label>
                  <select
                    value={expenseForm.category}
                    onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#FAF8FB] border-[1.5px] border-[#E8E3ED] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Select...</option>
                    <option value="rent">Rent</option>
                    <option value="transport">Transport</option>
                    <option value="supplies">Supplies</option>
                    <option value="utilities">Utilities</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddExpense}
                  disabled={saving || !expenseForm.description || !expenseForm.amount}
                  className="flex-1 bg-primary text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Add Expense'}
                </button>
                <button
                  onClick={() => { setShowExpenseForm(false); setExpenseForm({ description: '', amount: '', category: '' }) }}
                  className="px-4 rounded-lg py-2.5 text-sm font-medium border"
                  style={{ borderColor: '#E8E3ED', color: '#6B6373' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Expense list */}
          {expenseList.length > 0 && (
            <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: SHADOW }}>
              <button
                onClick={() => setShowExpenses(v => !v)}
                className="w-full px-4 py-3 flex items-center justify-between text-left"
                style={{ borderBottom: showExpenses ? '1px solid #E8E3ED' : 'none' }}
              >
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6B6373' }}>
                  Expense Details ({expenseList.length})
                </span>
                <span style={{ fontSize: 10, color: '#6B6373' }}>{showExpenses ? '▲' : '▼'}</span>
              </button>
              {showExpenses && (
                <div>
                  {expenseList.map((ex, i) => (
                    <div key={ex.id}
                      className="px-4 py-2.5 flex items-center justify-between"
                      style={{ borderBottom: i < expenseList.length - 1 ? '1px solid #F0EBF5' : 'none' }}>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate" style={{ color: '#1E1626' }}>{ex.description}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px]" style={{ color: '#6B6373' }}>{fmtDate(ex.created_at)}</span>
                          {ex.category && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#F1F3F5', color: '#4B5563' }}>
                              {ex.category}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <span className="text-sm font-bold tabnum" style={{ color: '#B23A3A' }}>KES {fmt(Number(ex.amount))}</span>
                        <button
                          onClick={() => handleDeleteExpense(ex.id)}
                          className="w-6 h-6 rounded flex items-center justify-center"
                          style={{ color: '#B23A3A', opacity: 0.6 }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
