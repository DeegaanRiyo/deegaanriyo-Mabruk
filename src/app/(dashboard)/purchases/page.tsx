'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PurchaseOrder, PurchaseOrderItem, Supplier } from '@/lib/types'
import { fmt, fmtDate } from '@/lib/utils'
import {
  Plus, ChevronDown, ChevronUp, ChevronLeft,
  Truck, Package, AlertTriangle, Check, X, Edit3,
} from 'lucide-react'

const PRIMARY     = 'var(--color-primary)'
const MUTED       = 'var(--color-muted)'
const SUCCESS     = 'var(--color-success)'
const AMBER       = 'var(--color-warning)'
const DANGER      = 'var(--color-danger)'
const CARD_SHADOW = 'var(--shadow-card)'
const INP = 'w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#5B2A86] focus:ring-2 focus:ring-[#5B2A86]/20 transition'

/* ── Supplier summary (computed from orders) ── */
interface SupplierSummary {
  id: string | null
  name: string
  phone: string | null
  orderCount: number
  totalSpent: number
  totalPaid: number
  totalOwed: number
  receipts: PurchaseOrder[]
}

export default function PurchasesPage() {
  const supabase = createClient()

  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  // Detail view
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null)
  const [expandedReceipt, setExpandedReceipt] = useState<string | null>(null)
  const [receiptItems, setReceiptItems] = useState<Record<string, PurchaseOrderItem[]>>({})
  const [loadingItems, setLoadingItems] = useState<string | null>(null)

  // Edit paid amount
  const [editingPO, setEditingPO] = useState<string | null>(null)
  const [editPaid, setEditPaid] = useState('')
  const [savingPaid, setSavingPaid] = useState(false)

  useEffect(() => { loadData() }, []) // eslint-disable-line

  async function loadData() {
    setLoading(true)
    const [{ data: ordersData }, { data: suppData }] = await Promise.all([
      supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
    ])
    setOrders((ordersData ?? []) as PurchaseOrder[])
    setSuppliers((suppData ?? []) as Supplier[])
    setLoading(false)
  }

  // Build supplier summaries from orders
  const supplierMap = new Map<string, SupplierSummary>()
  for (const o of orders) {
    const key = o.supplier_name
    const existing = supplierMap.get(key)
    if (existing) {
      existing.orderCount += 1
      existing.totalSpent += o.total_amount
      existing.totalPaid += o.paid_amount
      existing.totalOwed += Math.max(0, o.total_amount - o.paid_amount)
      existing.receipts.push(o)
    } else {
      const sup = suppliers.find(s => s.name === key)
      supplierMap.set(key, {
        id: o.supplier_id || sup?.id || null,
        name: key,
        phone: sup?.phone || o.supplier_phone || null,
        orderCount: 1,
        totalSpent: o.total_amount,
        totalPaid: o.paid_amount,
        totalOwed: Math.max(0, o.total_amount - o.paid_amount),
        receipts: [o],
      })
    }
  }
  const supplierList = Array.from(supplierMap.values()).sort((a, b) => b.totalSpent - a.totalSpent)

  // Total owed across all suppliers
  const totalOwedAll = supplierList.reduce((s, sup) => s + sup.totalOwed, 0)

  async function loadReceiptItems(orderId: string) {
    if (receiptItems[orderId]) return // already loaded
    setLoadingItems(orderId)
    const { data } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', orderId)
      .order('created_at')
    setReceiptItems(prev => ({ ...prev, [orderId]: (data ?? []) as PurchaseOrderItem[] }))
    setLoadingItems(null)
  }

  async function toggleReceipt(orderId: string) {
    if (expandedReceipt === orderId) {
      setExpandedReceipt(null)
      return
    }
    setExpandedReceipt(orderId)
    await loadReceiptItems(orderId)
  }

  async function handleSavePaid(orderId: string) {
    const newPaid = parseFloat(editPaid)
    if (isNaN(newPaid) || newPaid < 0) return

    setSavingPaid(true)
    const { error } = await supabase
      .from('purchase_orders')
      .update({ paid_amount: newPaid, updated_at: new Date().toISOString() })
      .eq('id', orderId)

    if (!error) {
      setOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, paid_amount: newPaid } : o
      ))
      // Update selected supplier view
      if (selectedSupplier) {
        setSelectedSupplier(prev => {
          if (!prev) return prev
          const updated = prev.receipts.map(r =>
            r.id === orderId ? { ...r, paid_amount: newPaid } : r
          )
          return {
            ...prev,
            receipts: updated,
            totalPaid: updated.reduce((s, r) => s + r.paid_amount, 0),
            totalOwed: updated.reduce((s, r) => s + Math.max(0, r.total_amount - r.paid_amount), 0),
          }
        })
      }
      setEditingPO(null)
    }
    setSavingPaid(false)
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4 max-w-[1209px] mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-[#E8E3ED] rounded-xl w-48" />
          {[1,2,3].map(i => <div key={i} className="h-28 bg-[#E8E3ED] rounded-xl" />)}
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════
     SUPPLIER DETAIL VIEW
     ═══════════════════════════════════════════════════ */
  if (selectedSupplier) {
    const sup = selectedSupplier
    return (
      <div className="p-4 space-y-4 max-w-[1209px] mx-auto pb-24">
        {/* Back + header */}
        <button
          onClick={() => { setSelectedSupplier(null); setExpandedReceipt(null); setEditingPO(null) }}
          className="flex items-center gap-1 text-sm font-semibold transition active:scale-95"
          style={{ color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <ChevronLeft size={16} /> All Suppliers
        </button>

        {/* Supplier header card */}
        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: CARD_SHADOW }}>
          <div className="flex items-start gap-4">
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 52, height: 52, borderRadius: '50%',
                background: '#EDE4F5', color: PRIMARY,
                fontSize: 20, fontWeight: 800,
              }}
            >
              {sup.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base" style={{ color: '#1E1626' }}>{sup.name}</div>
              {sup.phone && (
                <div className="text-xs mt-0.5" style={{ color: MUTED }}>{sup.phone}</div>
              )}
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="text-center p-3 rounded-xl" style={{ background: '#FAF8FB' }}>
              <div className="text-xs font-semibold" style={{ color: MUTED }}>Receipts</div>
              <div className="text-lg font-bold tabnum" style={{ color: '#1E1626' }}>{sup.orderCount}</div>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ background: '#FAF8FB' }}>
              <div className="text-xs font-semibold" style={{ color: MUTED }}>Total</div>
              <div className="text-sm font-bold tabnum" style={{ color: '#1E1626' }}>
                {fmt(sup.totalSpent)}
              </div>
            </div>
            <div className="text-center p-3 rounded-xl" style={{
              background: sup.totalOwed > 0 ? '#FEF3C7' : '#E3F3EC',
            }}>
              <div className="text-xs font-semibold" style={{ color: sup.totalOwed > 0 ? AMBER : SUCCESS }}>
                {sup.totalOwed > 0 ? 'Owed' : 'Settled'}
              </div>
              <div className="text-sm font-bold tabnum" style={{ color: sup.totalOwed > 0 ? '#92400E' : SUCCESS }}>
                {fmt(sup.totalOwed)}
              </div>
            </div>
          </div>
        </div>

        {/* Receipts list */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>
            Receipts / Batches
          </div>

          {sup.receipts.map(receipt => {
            const balance = receipt.total_amount - receipt.paid_amount
            const isUnpaid = balance > 0.005
            const isExpanded = expandedReceipt === receipt.id
            const isEditing = editingPO === receipt.id
            const items = receiptItems[receipt.id]

            return (
              <div key={receipt.id} className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
                {/* Receipt header — clickable */}
                <button
                  onClick={() => toggleReceipt(receipt.id)}
                  className="w-full text-left p-4 flex items-center gap-3 transition"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm" style={{ color: '#1E1626' }}>
                        #{receipt.receipt_number || '—'}
                      </span>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: receipt.receipt_type === 'credit_note' ? '#FDE8E8' : (isUnpaid ? '#FEF3C7' : '#E3F3EC'),
                          color: receipt.receipt_type === 'credit_note' ? DANGER : (isUnpaid ? AMBER : SUCCESS),
                        }}
                      >
                        {receipt.receipt_type === 'credit_note' ? 'Credit Note' : (isUnpaid ? 'Unpaid' : 'Paid')}
                      </span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: MUTED }}>
                      {receipt.receipt_date ? fmtDate(receipt.receipt_date) : fmtDate(receipt.created_at)}
                      {receipt.customer_name && <span> &middot; {receipt.customer_name}</span>}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-sm tabnum" style={{ color: '#1E1626' }}>
                      KES {fmt(receipt.total_amount)}
                    </div>
                    {isUnpaid && (
                      <div className="text-xs font-semibold tabnum" style={{ color: AMBER }}>
                        Owes {fmt(balance)}
                      </div>
                    )}
                  </div>

                  <span style={{ color: MUTED, flexShrink: 0 }}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t" style={{ borderColor: '#E8E3ED' }}>
                    {/* Payment row — editable */}
                    <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#FAF8FB' }}>
                      <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-xs" style={{ color: MUTED }}>Total</div>
                          <div className="font-bold tabnum">{fmt(receipt.total_amount)}</div>
                        </div>
                        <div>
                          <div className="text-xs" style={{ color: MUTED }}>Paid</div>
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={editPaid}
                              onChange={e => setEditPaid(e.target.value)}
                              autoFocus
                              className="w-full px-2 py-1 rounded-lg border text-sm font-bold tabnum"
                              style={{ borderColor: PRIMARY, maxWidth: 120 }}
                            />
                          ) : (
                            <div className="font-bold tabnum" style={{ color: SUCCESS }}>
                              {fmt(receipt.paid_amount)}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs" style={{ color: MUTED }}>Balance</div>
                          <div className="font-bold tabnum" style={{ color: isUnpaid ? AMBER : SUCCESS }}>
                            {isEditing
                              ? fmt(Math.max(0, receipt.total_amount - (parseFloat(editPaid) || 0)))
                              : fmt(balance)
                            }
                          </div>
                        </div>
                      </div>

                      {/* Edit / Save / Cancel */}
                      {isEditing ? (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => handleSavePaid(receipt.id)}
                            disabled={savingPaid}
                            className="p-1.5 rounded-lg transition active:scale-95"
                            style={{ background: '#E3F3EC', color: SUCCESS }}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => setEditingPO(null)}
                            className="p-1.5 rounded-lg transition"
                            style={{ background: '#FDE8E8', color: DANGER }}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingPO(receipt.id); setEditPaid(String(receipt.paid_amount)) }}
                          className="p-1.5 rounded-lg transition active:scale-95 flex-shrink-0"
                          style={{ background: '#EDE4F5', color: PRIMARY }}
                          title="Edit paid amount"
                        >
                          <Edit3 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Line items */}
                    <div className="px-4 py-2">
                      {loadingItems === receipt.id && (
                        <div className="text-xs py-4 text-center" style={{ color: MUTED }}>Loading items...</div>
                      )}
                      {items && items.length === 0 && (
                        <div className="text-xs py-4 text-center" style={{ color: MUTED }}>No items recorded</div>
                      )}
                      {items && items.length > 0 && (
                        <div className="divide-y" style={{ borderColor: '#F3F0F5' }}>
                          {/* Header */}
                          <div className="grid grid-cols-12 gap-1 py-1.5 text-xs font-bold" style={{ color: MUTED }}>
                            <div className="col-span-5">Product</div>
                            <div className="col-span-2 text-right">Qty</div>
                            <div className="col-span-2 text-right">Cost</div>
                            <div className="col-span-3 text-right">Total</div>
                          </div>
                          {items.map(item => (
                            <div key={item.id} className="grid grid-cols-12 gap-1 py-2 text-xs items-center">
                              <div className="col-span-5 font-medium truncate" style={{ color: '#1E1626' }}>
                                {item.product_name}
                              </div>
                              <div className="col-span-2 text-right tabnum" style={{ color: MUTED }}>
                                {item.quantity}
                              </div>
                              <div className="col-span-2 text-right tabnum" style={{ color: MUTED }}>
                                {fmt(item.buy_price)}
                              </div>
                              <div className="col-span-3 text-right tabnum font-semibold" style={{ color: '#1E1626' }}>
                                {fmt(item.line_total)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════
     SUPPLIER CARDS VIEW (top level)
     ═══════════════════════════════════════════════════ */
  return (
    <div className="p-4 space-y-4 max-w-[1209px] mx-auto pb-24">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold" style={{ color: '#1E1626' }}>Purchase Orders</h1>
        <Link
          href="/purchases/new"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition active:scale-95"
          style={{ background: PRIMARY, color: 'white', textDecoration: 'none' }}
        >
          <Plus size={15} />
          Receive Stock
        </Link>
      </div>

      {/* Overall summary */}
      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 text-center" style={{ boxShadow: CARD_SHADOW }}>
            <div className="text-xs font-semibold" style={{ color: MUTED }}>Suppliers</div>
            <div className="text-xl font-bold mt-1" style={{ color: '#1E1626' }}>{supplierList.length}</div>
          </div>
          <div className="bg-white rounded-xl p-4 text-center" style={{ boxShadow: CARD_SHADOW }}>
            <div className="text-xs font-semibold" style={{ color: MUTED }}>Total Orders</div>
            <div className="text-xl font-bold mt-1 tabnum" style={{ color: '#1E1626' }}>{orders.length}</div>
          </div>
          <div
            className="rounded-xl p-4 text-center"
            style={{
              boxShadow: CARD_SHADOW,
              background: totalOwedAll > 0 ? '#FEF3C7' : '#E3F3EC',
            }}
          >
            <div className="text-xs font-semibold" style={{ color: totalOwedAll > 0 ? AMBER : SUCCESS }}>
              Total Owed
            </div>
            <div className="text-lg font-bold mt-1 tabnum" style={{ color: totalOwedAll > 0 ? '#92400E' : SUCCESS }}>
              {fmt(totalOwedAll)}
            </div>
          </div>
        </div>
      )}

      {/* Supplier cards */}
      {supplierList.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <Truck size={40} className="mx-auto" style={{ color: '#E8E3ED' }} />
          <div className="text-sm font-medium" style={{ color: MUTED }}>
            No purchase orders yet
          </div>
          <Link
            href="/purchases/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: PRIMARY, color: 'white', textDecoration: 'none' }}
          >
            <Plus size={14} /> Add your first stock
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {supplierList.map(sup => (
          <button
            key={sup.name}
            onClick={() => setSelectedSupplier(sup)}
            className="w-full text-left bg-white rounded-xl p-4 transition active:scale-[0.98]"
            style={{ boxShadow: CARD_SHADOW, border: 'none', cursor: 'pointer' }}
          >
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: sup.totalOwed > 0 ? '#FEF3C7' : '#EDE4F5',
                  color: sup.totalOwed > 0 ? '#92400E' : PRIMARY,
                  fontSize: 18, fontWeight: 800,
                }}
              >
                {sup.name[0]}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate" style={{ color: '#1E1626' }}>
                  {sup.name}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: MUTED }}>
                  <span className="flex items-center gap-1">
                    <Package size={11} /> {sup.orderCount} receipt{sup.orderCount !== 1 ? 's' : ''}
                  </span>
                  <span className="tabnum">KES {fmt(sup.totalSpent)}</span>
                </div>
              </div>

              {/* Owed badge */}
              <div className="text-right flex-shrink-0">
                {sup.totalOwed > 0 ? (
                  <>
                    <div className="text-xs font-semibold" style={{ color: AMBER }}>Owed</div>
                    <div className="font-bold text-sm tabnum" style={{ color: '#92400E' }}>
                      {fmt(sup.totalOwed)}
                    </div>
                  </>
                ) : (
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: '#E3F3EC', color: SUCCESS }}
                  >
                    Settled
                  </span>
                )}
              </div>

              <ChevronDown size={16} style={{ color: MUTED, flexShrink: 0 }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
