'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'
import { Sale } from '@/lib/types'
import { fmt, fmtDate, fmtTime } from '@/lib/utils'
import { Receipt, Download, ChevronDown, Trash2, Search, X, ShoppingBag, Banknote, Smartphone, AlertCircle } from 'lucide-react'

const C = {
  surface: '#FFFFFF',
  fg: '#1E1626',
  primary: '#5B2A86',
  primaryLight: '#EDE4F5',
  muted: '#6B6373',
  border: '#E8E3ED',
  success: '#2E7D5B',
  successLight: '#E3F3EC',
  warning: '#B8791C',
  warningLight: '#FBF0DC',
  danger: '#B23A3A',
  dangerLight: '#FBE9E9',
  headerBg: '#F7F4FA',
  rowAlt: '#FAFAFB',
  bg: '#FAF8FB',
} as const

export default function SalesPage() {
  const supabase = createClient()
  const { isOwner } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'today' | 'week' | 'all'>('today')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [cardFilter, setCardFilter] = useState<'all' | 'cash' | 'mpesa' | 'outstanding' | null>(null)

  const PAGE_SIZE = 50

  useEffect(() => { loadSales(); setDeleteConfirm(null) }, [filter]) // eslint-disable-line

  async function loadSales(append = false) {
    if (!append) setLoading(true); else setLoadingMore(true)
    let query = supabase.from('sales').select('*').order('created_at', { ascending: false })
    if (filter === 'today') {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      query = query.gte('created_at', today.toISOString())
    } else if (filter === 'week') {
      const week = new Date(); week.setDate(week.getDate() - 7)
      query = query.gte('created_at', week.toISOString())
    } else {
      const start = append ? sales.length : 0
      query = query.range(start, start + PAGE_SIZE - 1)
    }
    const { data } = await query
    const rows = (data ?? []) as Sale[]
    if (append) setSales(prev => [...prev, ...rows]); else setSales(rows)
    setHasMore(filter === 'all' && rows.length === PAGE_SIZE)
    if (!append) setLoading(false); else setLoadingMore(false)
  }

  const totalRevenue = sales.reduce((s, r) => s + Number(r.total), 0)
  const totalPaid = sales.reduce((s, r) => s + Number(r.paid_amount), 0)
  const totalOutstanding = totalRevenue - totalPaid

  const cashSales = sales.filter(s => s.method === 'cash')
  const mpesaSales = sales.filter(s => s.method === 'mpesa')
  const splitSales = sales.filter(s => s.method === 'split')
  const outstandingSales = sales.filter(s => Number(s.total) - Number(s.paid_amount) > 0)

  const totalCash = cashSales.reduce((s, r) => s + Number(r.total), 0)
    + splitSales.reduce((s, r) => s + Number(r.cash_amount), 0)
  const totalMpesa = mpesaSales.reduce((s, r) => s + Number(r.total), 0)
    + splitSales.reduce((s, r) => s + Number(r.mpesa_amount), 0)

  // Apply search + card filter
  const displaySales = sales.filter(s => {
    // Card filter
    if (cardFilter === 'cash' && s.method !== 'cash') return false
    if (cardFilter === 'mpesa' && s.method !== 'mpesa') return false
    if (cardFilter === 'outstanding' && Number(s.total) - Number(s.paid_amount) <= 0) return false
    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const matchName = s.client_name?.toLowerCase().includes(q)
      const matchPhone = s.client_phone?.toLowerCase().includes(q)
      const matchRef = s.mpesa_ref?.toLowerCase().includes(q)
      const matchAmount = String(s.total).includes(q)
      if (!matchName && !matchPhone && !matchRef && !matchAmount) return false
    }
    return true
  })

  function exportSalesCSV() {
    const rows = [
      ['Date', 'Time', 'Total', 'Paid', 'Outstanding', 'Method', 'Client', 'Phone', 'M-Pesa Ref'],
      ...sales.map(s => [
        fmtDate(s.created_at), fmtTime(s.created_at),
        String(s.total), String(s.paid_amount),
        String(Number(s.total) - Number(s.paid_amount)),
        s.method || '', s.client_name || '', s.client_phone || '', s.mpesa_ref || '',
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `mabruk-sales-${filter}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDelete(saleId: string) {
    // Two-tap: first tap shows confirm, second tap deletes
    if (deleteConfirm !== saleId) { setDeleteConfirm(saleId); return }
    setDeleting(true)
    const { error } = await supabase.from('sales').delete().eq('id', saleId)
    if (error) {
      alert('Failed to delete sale: ' + error.message)
      setDeleting(false)
      setDeleteConfirm(null)
      return
    }
    setSales(prev => prev.filter(s => s.id !== saleId))
    setDeleteConfirm(null)
    setDeleting(false)
  }

  return (
    <div className="p-3 space-y-3">

      {/* Filter + Export */}
      <div className="flex items-center gap-2">
        {(['today', 'week', 'all'] as const).map(f => (
          <button key={f} onClick={() => { setFilter(f); setCardFilter(null) }}
            className="px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95"
            style={{
              background: filter === f ? C.primary : C.surface,
              color: filter === f ? '#fff' : C.muted,
              border: `2px solid ${filter === f ? C.primary : C.border}`,
            }}>
            {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'All'}
          </button>
        ))}
        {!loading && sales.length > 0 && (
          <button onClick={exportSalesCSV}
            className="ml-auto flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition active:scale-95"
            style={{ background: C.primaryLight, color: C.primary }}>
            <Download size={12} /> Export
          </button>
        )}
      </div>

      {/* Search */}
      {!loading && sales.length > 0 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer, phone, M-Pesa ref, or amount..."
            className="w-full pl-9 pr-9 py-2.5 rounded-xl text-xs font-semibold outline-none transition-all"
            style={{ background: C.surface, color: C.fg, border: `2px solid ${search ? C.primary : C.border}` }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full active:scale-90"
              style={{ color: C.muted }}>
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        {([
          {
            key: 'all' as const,
            label: 'Total Sales',
            value: fmt(totalRevenue),
            sub: `${sales.length} transaction${sales.length !== 1 ? 's' : ''}`,
            icon: ShoppingBag,
            color: C.primary,
            bg: C.primaryLight,
          },
          {
            key: 'cash' as const,
            label: 'Cash',
            value: fmt(totalCash),
            sub: `${cashSales.length + splitSales.length} sale${cashSales.length + splitSales.length !== 1 ? 's' : ''}`,
            icon: Banknote,
            color: C.success,
            bg: C.successLight,
          },
          {
            key: 'mpesa' as const,
            label: 'M-Pesa',
            value: fmt(totalMpesa),
            sub: `${mpesaSales.length + splitSales.length} sale${mpesaSales.length + splitSales.length !== 1 ? 's' : ''}`,
            icon: Smartphone,
            color: '#0891b2',
            bg: '#ecfeff',
          },
          {
            key: 'outstanding' as const,
            label: 'Outstanding',
            value: fmt(totalOutstanding),
            sub: `${outstandingSales.length} unpaid`,
            icon: AlertCircle,
            color: totalOutstanding > 0 ? C.danger : C.muted,
            bg: totalOutstanding > 0 ? C.dangerLight : '#f5f5f5',
          },
        ]).map(({ key, label, value, sub, icon: Icon, color, bg }) => {
          const active = cardFilter === key
          return (
            <button key={key}
              onClick={() => setCardFilter(active ? null : key)}
              className="rounded-xl overflow-hidden text-left transition-all active:scale-[0.97]"
              style={{
                background: active ? color : C.surface,
                boxShadow: active ? `0 2px 8px ${color}40` : '0 1px 3px rgba(0,0,0,0.06)',
                border: `2px solid ${active ? color : 'transparent'}`,
              }}>
              <div className="px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="p-1 rounded-md" style={{ background: active ? 'rgba(255,255,255,0.2)' : bg }}>
                    <Icon size={12} style={{ color: active ? '#fff' : color }} />
                  </div>
                  <div className="text-[9px] font-black uppercase tracking-widest"
                    style={{ color: active ? 'rgba(255,255,255,0.8)' : C.muted }}>
                    {label}
                  </div>
                </div>
                <div className="text-base font-black tabnum" style={{ color: active ? '#fff' : color }}>
                  {value}
                </div>
                <div className="text-[10px] font-semibold mt-0.5"
                  style={{ color: active ? 'rgba(255,255,255,0.7)' : C.muted }}>
                  {sub}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Active filter indicator */}
      {(cardFilter || search) && !loading && (
        <div className="flex items-center gap-2 text-[11px] font-bold" style={{ color: C.muted }}>
          <span>Showing {displaySales.length} of {sales.length} sales</span>
          {(cardFilter || search) && (
            <button onClick={() => { setCardFilter(null); setSearch('') }}
              className="px-2 py-0.5 rounded-md active:scale-95 transition"
              style={{ background: C.primaryLight, color: C.primary }}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Sales table */}
      {loading ? (
        <div className="space-y-1">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: C.border, opacity: 0.4 }} />)}
        </div>
      ) : displaySales.length === 0 ? (
        <div className="text-center py-16" style={{ color: C.muted }}>
          <Receipt size={32} className="mx-auto mb-3 opacity-20" />
          <div className="text-sm font-bold">
            {search || cardFilter
              ? 'No sales match your filter'
              : `No sales ${filter === 'today' ? 'today' : filter === 'week' ? 'this week' : ''}`}
          </div>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: C.surface, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.headerBg, borderBottom: `2px solid ${C.border}` }}>
                  {[
                    ['Date', 'left', 130],
                    ['Customer', 'left', 160],
                    ['Method', 'center', 75],
                    ['Total', 'right', 100],
                    ['Paid', 'right', 100],
                    ['Status', 'center', 90],
                    ...(isOwner ? [['', 'center', 44]] : []),
                  ].map(([label, align, w]) => (
                    <th key={String(label)} style={{
                      textAlign: align as 'left' | 'right' | 'center',
                      width: Number(w), padding: '8px 10px',
                      fontSize: 9, fontWeight: 900, letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: C.muted, whiteSpace: 'nowrap',
                      background: C.headerBg,
                    }}>{label as string}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displaySales.map((s, i) => {
                  const outstanding = Number(s.total) - Number(s.paid_amount)
                  return (
                    <tr key={s.id}
                      className="cursor-pointer transition-colors"
                      style={{ background: i % 2 === 0 ? C.surface : C.rowAlt, borderBottom: `1px solid ${C.border}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? C.surface : C.rowAlt)}
                      onClick={() => window.location.href = `/sales/${s.id}/receipt`}>

                      {/* Date */}
                      <td style={{ padding: '8px 10px' }}>
                        <div className="text-xs font-bold" style={{ color: C.fg }}>{fmtDate(s.created_at)}</div>
                        <div className="text-[10px] font-semibold" style={{ color: C.muted }}>{fmtTime(s.created_at)}</div>
                      </td>

                      {/* Customer */}
                      <td style={{ padding: '8px 10px' }}>
                        <div className="text-xs font-bold truncate" style={{ color: C.fg, maxWidth: 150 }}>
                          {s.client_name || '---'}
                        </div>
                        {s.client_phone && (
                          <div className="text-[10px] font-semibold" style={{ color: C.muted }}>{s.client_phone}</div>
                        )}
                      </td>

                      {/* Method */}
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        {s.method && (
                          <span className="text-[9px] font-black px-2 py-1 rounded-md inline-block"
                            style={{
                              background: s.method === 'mpesa' ? C.successLight : s.method === 'split' ? C.warningLight : C.primaryLight,
                              color: s.method === 'mpesa' ? C.success : s.method === 'split' ? C.warning : C.primary,
                            }}>
                            {s.method === 'split' ? 'SPLIT' : s.method === 'mpesa' ? 'M-PESA' : 'CASH'}
                          </span>
                        )}
                      </td>

                      {/* Total */}
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        <span className="tabnum font-black text-sm" style={{ color: C.fg }}>
                          {fmt(Number(s.total))}
                        </span>
                      </td>

                      {/* Paid */}
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        <span className="tabnum font-bold text-sm" style={{ color: C.success }}>
                          {fmt(Number(s.paid_amount))}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        {outstanding > 0 ? (
                          <span className="text-[10px] font-black px-2 py-1 rounded-md"
                            style={{ background: C.dangerLight, color: C.danger }}>
                            Owes {fmt(outstanding)}
                          </span>
                        ) : (
                          <span className="text-[10px] font-black px-2 py-1 rounded-md"
                            style={{ background: C.successLight, color: C.success }}>
                            Paid
                          </span>
                        )}
                      </td>

                      {/* Delete (owner only) */}
                      {isOwner && (
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                          <button
                            disabled={deleting}
                            onClick={e => { e.stopPropagation(); handleDelete(s.id) }}
                            className="p-1.5 rounded-lg transition-all active:scale-90"
                            style={{
                              background: deleteConfirm === s.id ? C.danger : C.dangerLight,
                              color: deleteConfirm === s.id ? '#fff' : C.danger,
                            }}
                            title={deleteConfirm === s.id ? 'Tap again to confirm' : 'Delete sale & restore stock'}>
                            <Trash2 size={13} strokeWidth={2.5} />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasMore && (
        <button onClick={() => loadSales(true)} disabled={loadingMore}
          className="w-full py-2.5 rounded-xl text-xs font-black transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
          style={{ background: C.primaryLight, color: C.primary }}>
          <ChevronDown size={13} /> {loadingMore ? 'Loading...' : 'Load older sales'}
        </button>
      )}
    </div>
  )
}
