'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'
import { Sale } from '@/lib/types'
import { fmt, fmtDate, fmtTime } from '@/lib/utils'
import { Receipt, Download, ChevronDown, Trash2 } from 'lucide-react'

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
          <button key={f} onClick={() => setFilter(f)}
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

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Revenue', value: fmt(totalRevenue), color: C.primary, accent: C.primary },
          { label: 'Collected', value: fmt(totalPaid), color: C.success, accent: C.success },
          { label: 'Owed', value: fmt(totalOutstanding), color: totalOutstanding > 0 ? C.danger : C.muted, accent: totalOutstanding > 0 ? C.danger : C.border },
        ].map(({ label, value, color, accent }) => (
          <div key={label} className="rounded-xl overflow-hidden flex" style={{ background: C.surface, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="w-1 flex-shrink-0" style={{ background: accent }} />
            <div className="flex-1 px-3 py-2">
              <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: C.muted }}>{label}</div>
              <div className="text-base font-black tabnum" style={{ color }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Sales table */}
      {loading ? (
        <div className="space-y-1">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: C.border, opacity: 0.4 }} />)}
        </div>
      ) : sales.length === 0 ? (
        <div className="text-center py-16" style={{ color: C.muted }}>
          <Receipt size={32} className="mx-auto mb-3 opacity-20" />
          <div className="text-sm font-bold">No sales {filter === 'today' ? 'today' : filter === 'week' ? 'this week' : ''}</div>
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
                {sales.map((s, i) => {
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
                            -{fmt(outstanding)}
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
