'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Product, PRODUCT_CATEGORIES, UNIT_LABELS, UNIT_TYPES,
  UnitType, isMultiUnit, Supplier,
} from '@/lib/types'
import type { ParsedReceipt, ParsedReceiptItem } from '@/lib/receipt-parser'
import { fmt } from '@/lib/utils'
import {
  Upload, FileText, Check, X, AlertTriangle,
  Plus, Trash2, Tag, ClipboardList,
} from 'lucide-react'

const PRIMARY = 'var(--color-primary)'
const MUTED   = 'var(--color-muted)'
const SUCCESS = 'var(--color-success)'
const AMBER   = 'var(--color-warning)'
const DANGER  = 'var(--color-danger)'
const SHADOW  = 'var(--shadow-card)'
const INP     = 'w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#5B2A86] focus:ring-2 focus:ring-[#5B2A86]/20 transition'

/* ── Seeded item = parsed receipt item + matched product + editable state ── */
interface SeedItem extends ParsedReceiptItem {
  matchedProduct: Product | null
  sellPrice: string
  editingPrice: boolean
  include: boolean
  ppu: string
  editCategory: string
}

/* ── Manual item row ── */
interface ManualItem {
  code: string
  name: string
  category: string
  unit_type: UnitType
  ppu: string
  qty: string
  cost: string        // cost per unit (or per piece if PC)
  sellPrice: string
  matchedProduct: Product | null
}

const emptyManualItem = (): ManualItem => ({
  code: '', name: '', category: '', unit_type: 'PC', ppu: '1',
  qty: '', cost: '', sellPrice: '', matchedProduct: null,
})

export default function AddStockPage() {
  const supabase = createClient()
  const router   = useRouter()
  const fileRef  = useRef<HTMLInputElement>(null)

  // ── Tab ───────────────────────────────────────────────────
  const [tab, setTab] = useState<'manual' | 'receipt'>('manual')

  // ── Shared supplier state ─────────────────────────────────
  const [supplierName,  setSupplierName]  = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')
  const [suppliers,     setSuppliers]     = useState<Supplier[]>([])
  const [allProducts,   setAllProducts]   = useState<Product[]>([])

  // ── Payment state ─────────────────────────────────────────
  const [payMethod,  setPayMethod]  = useState<'cash' | 'mpesa' | 'credit'>('cash')
  const [paidAmount, setPaidAmount] = useState('')
  const [mpesaRef,   setMpesaRef]   = useState('')

  // ── Save state ────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState('')

  // ── Manual items ──────────────────────────────────────────
  const [manualItems, setManualItems] = useState<ManualItem[]>([emptyManualItem()])

  // ── PDF state ─────────────────────────────────────────────
  const [uploading, setUploading] = useState(false)
  const [fileName,  setFileName]  = useState('')
  const [receipt,   setReceipt]   = useState<ParsedReceipt | null>(null)
  const [pdfItems,  setPdfItems]  = useState<SeedItem[]>([])

  // ── Load suppliers & products on mount ────────────────────
  useEffect(() => {
    supabase.from('suppliers').select('*').order('name').then(({ data }: { data: Supplier[] | null }) => {
      setSuppliers((data ?? []) as Supplier[])
    })
    supabase.from('products').select('*').eq('is_active', true).then(({ data }: { data: Product[] | null }) => {
      setAllProducts((data ?? []) as Product[])
    })
  }, []) // eslint-disable-line

  // ── Match a name against existing products ────────────────
  function findProduct(name: string): Product | null {
    if (!name.trim()) return null
    const n = name.trim().toLowerCase()
    return allProducts.find(p => p.name.trim().toLowerCase() === n) ?? null
  }

  // ── MANUAL: update item ───────────────────────────────────
  function updateManual(idx: number, patch: Partial<ManualItem>) {
    setManualItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, ...patch }
      // Auto-match product when name changes
      if ('name' in patch) {
        updated.matchedProduct = findProduct(patch.name ?? '')
        if (updated.matchedProduct) {
          updated.sellPrice = updated.sellPrice || String(updated.matchedProduct.sell_price || '')
          updated.code = updated.code || updated.matchedProduct.code || ''
          updated.category = updated.category || updated.matchedProduct.category || ''
          updated.unit_type = updated.matchedProduct.unit_type
          updated.ppu = String(updated.matchedProduct.pieces_per_unit || 1)
        }
      }
      return updated
    }))
  }

  function addManualRow() {
    setManualItems(prev => [...prev, emptyManualItem()])
  }

  function removeManualRow(idx: number) {
    setManualItems(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx))
  }

  // ── MANUAL: totals ────────────────────────────────────────
  const validManualItems = manualItems.filter(i => i.name.trim() && parseFloat(i.qty) > 0 && parseFloat(i.cost) > 0)
  const manualTotal = validManualItems.reduce((s, i) => {
    const qty = parseFloat(i.qty) || 0
    const cost = parseFloat(i.cost) || 0
    return s + qty * cost
  }, 0)

  // ── PDF: Upload & Parse ───────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file')
      return
    }
    setUploading(true)
    setError('')
    setFileName(file.name)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/parse-receipt', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to parse receipt')
        setUploading(false)
        return
      }

      const parsed = data as ParsedReceipt
      setReceipt(parsed)

      // Fill supplier from parsed receipt
      setSupplierName(parsed.supplier.name || '')
      setSupplierPhone(parsed.supplier.phone || '')

      // Match items against existing products
      const seedItems: SeedItem[] = parsed.items.map(item => {
        const normalizedName = item.name.trim().toLowerCase()
        const matched = allProducts.find(p => p.name.trim().toLowerCase() === normalizedName) ?? null
        return {
          ...item,
          matchedProduct: matched,
          sellPrice: matched ? String(matched.sell_price) : '',
          editingPrice: false,
          include: !item.voided,
          ppu: String(item.pieces_per_unit),
          editCategory: item.category || matched?.category || '',
        }
      })
      setPdfItems(seedItems)
      setPaidAmount(String(parsed.footer.total || ''))
    } catch {
      setError('Failed to upload file. Please try again.')
    }
    setUploading(false)
  }, [allProducts]) // eslint-disable-line

  function updatePdfItem(idx: number, patch: Partial<SeedItem>) {
    setPdfItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item))
  }

  // ── PDF: totals ───────────────────────────────────────────
  const activePdfItems = pdfItems.filter(i => i.include)
  const pdfOrderTotal  = activePdfItems.reduce((s, i) => s + i.amount, 0)
  const pdfDiscount    = receipt?.footer.total
    ? Math.max(0, pdfOrderTotal - receipt.footer.total) : 0
  const pdfFinalTotal  = receipt?.footer.total || pdfOrderTotal

  // ── Shared totals ─────────────────────────────────────────
  const isManual    = tab === 'manual'
  const finalTotal  = isManual ? manualTotal : pdfFinalTotal
  const paid        = parseFloat(paidAmount) || 0
  const outstanding = Math.max(0, finalTotal - paid)
  const isCredit    = payMethod === 'credit'

  // ── Save ──────────────────────────────────────────────────
  async function handleSave() {
    const itemsToSave = isManual ? validManualItems : activePdfItems
    if (itemsToSave.length === 0 || !supplierName.trim()) {
      setError(supplierName.trim() ? 'Add at least one item with name, qty, and cost' : 'Enter supplier name')
      return
    }
    setSaving(true)
    setError('')
    const createdProductIds: string[] = [] // track for rollback

    try {
      // 1. Upsert supplier
      let supplierId: string | null = null
      const { data: existingSup } = await supabase
        .from('suppliers').select('id').ilike('name', supplierName.trim()).limit(1).maybeSingle()

      if (existingSup) {
        supplierId = existingSup.id
      } else {
        const supInsert: Record<string, string | null> = { name: supplierName.trim() }
        if (supplierPhone.trim()) supInsert.phone = supplierPhone.trim()
        if (!isManual && receipt?.supplier) {
          supInsert.address  = receipt.supplier.address || null
          supInsert.kra_pin  = receipt.supplier.kra_pin || null
          supInsert.agent_no = receipt.supplier.agent_no || null
          supInsert.store_no = receipt.supplier.store_no || null
        }
        const { data: newSup } = await supabase.from('suppliers').insert(supInsert).select('id').single()
        supplierId = newSup?.id ?? null
      }

      // 2. Resolve product IDs — create new products as needed
      //    (must happen before the RPC since we need product_id for each item)
      const rpcItems: Record<string, unknown>[] = []
      const sellPriceUpdates: { id: string; sell_price: number; sell_price_piece: number | null }[] = []

      if (isManual) {
        for (const item of validManualItems) {
          const ppu      = parseInt(item.ppu) || 1
          const rawCost  = parseFloat(item.cost) || 0
          const rawQty   = parseFloat(item.qty) || 0
          const buyPerPc = ppu > 1 ? rawCost / ppu : rawCost
          const pieces   = rawQty * ppu
          const lineTotal = rawQty * rawCost

          let productId: string
          if (item.matchedProduct) {
            productId = item.matchedProduct.id
            if (item.code.trim() && !item.matchedProduct.code) {
              await supabase.from('products').update({ code: item.code.trim() }).eq('id', productId)
            }
          } else {
            const userSellPrice = parseFloat(item.sellPrice) || 0
            const { data: newProd, error: prodErr } = await supabase.from('products').insert({
              name: item.name.trim(), code: item.code.trim() || null,
              category: item.category || null, unit_type: item.unit_type,
              pieces_per_unit: ppu, buy_price: buyPerPc, sell_price: userSellPrice,
              sell_price_piece: ppu > 1 && userSellPrice > 0 ? Math.round(userSellPrice / ppu) : null,
              supplier_name: supplierName.trim(), supplier_id: supplierId, min_stock: 5,
            }).select('id').single()
            if (prodErr || !newProd) throw new Error(`Failed to create product: ${item.name}`)
            productId = newProd.id
            createdProductIds.push(productId)
          }

          rpcItems.push({ product_id: productId, product_name: item.name.trim(), quantity: pieces, buy_price: buyPerPc, line_total: lineTotal, supplier_code: item.code.trim() || null, vat_class: null, unit_type: item.unit_type })
          const sp = parseFloat(item.sellPrice) || 0
          if (sp > 0) sellPriceUpdates.push({ id: productId, sell_price: sp, sell_price_piece: ppu > 1 ? Math.round(sp / ppu) : null })
        }
      } else {
        for (const item of pdfItems) {
          const ppu = parseInt(item.ppu) || 1
          if (item.voided) continue
          if (!item.include) continue

          let productId: string
          if (item.matchedProduct) {
            productId = item.matchedProduct.id
            if (item.code && !item.matchedProduct.code) {
              await supabase.from('products').update({ code: item.code }).eq('id', productId)
            }
          } else {
            productId = await createPdfProduct(item, ppu, supplierId)
            createdProductIds.push(productId)
          }

          const buyPerPc = ppu > 1 ? item.rate / ppu : item.rate
          const pieces   = item.qty * ppu

          rpcItems.push({ product_id: productId, product_name: item.name, quantity: pieces, buy_price: buyPerPc, line_total: item.amount, supplier_code: item.code, vat_class: item.vat_class, unit_type: item.unit_type })
          const sp = parseFloat(item.sellPrice) || 0
          if (sp > 0) sellPriceUpdates.push({ id: productId, sell_price: sp, sell_price_piece: ppu > 1 ? Math.round(sp / ppu) : null })
        }
      }

      // 3. Call atomic RPC — creates PO + PO items + stock_entries
      //    (+ trigger bumps stock_qty) all in ONE Postgres transaction.
      //    If anything fails, the whole thing rolls back.
      const effectivePaid = isCredit ? 0 : Math.min(paid || finalTotal, finalTotal)
      const { error: rpcErr } = await supabase.rpc('receive_stock', {
        p_supplier_name:  supplierName.trim(),
        p_supplier_phone: supplierPhone.trim() || null,
        p_supplier_id:    supplierId,
        p_total_amount:   finalTotal,
        p_paid_amount:    effectivePaid,
        p_notes:          mpesaRef ? `M-Pesa: ${mpesaRef}` : null,
        p_receipt_number: (!isManual && receipt) ? (receipt.receipt.number || null) : null,
        p_receipt_type:   (!isManual && receipt) ? (receipt.receipt.type || null) : null,
        p_receipt_date:   (!isManual && receipt) ? (receipt.receipt.date || null) : null,
        p_discount:       (!isManual && receipt) ? pdfDiscount : 0,
        p_vat_total:      (!isManual && receipt) ? (receipt.footer.vat_a_amount || 0) : 0,
        p_served_by:      (!isManual && receipt) ? (receipt.receipt.served_by || null) : null,
        p_customer_name:  (!isManual && receipt) ? (receipt.receipt.customer || null) : null,
        p_items:          rpcItems,
      })
      if (rpcErr) throw new Error(rpcErr.message)

      // 4. Sell price updates (safe to do after — worst case they fail
      //    and the operator re-sets prices manually, no data corruption)
      await Promise.all(sellPriceUpdates.map(u =>
        supabase.from('products').update({ sell_price: u.sell_price, sell_price_piece: u.sell_price_piece }).eq('id', u.id)
      ))

      setSaved(true)
      const tid = setTimeout(() => router.push('/purchases'), 1500)
      return () => clearTimeout(tid)
    } catch (err) {
      // RPC rolled back the PO + stock_entries + stock_qty changes.
      // Clean up any new products we created before the RPC call.
      if (createdProductIds.length > 0) {
        await supabase.from('products').delete().in('id', createdProductIds)
      }
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  async function createPdfProduct(item: SeedItem, ppu: number, supplierId: string | null): Promise<string> {
    const buyPerPc      = ppu > 1 ? item.rate / ppu : item.rate
    const userSellPrice = parseFloat(item.sellPrice) || 0

    const { data, error } = await supabase.from('products').insert({
      name:            item.name,
      code:            item.code || null,
      size:            item.pack_size || null,
      unit_type:       item.unit_type as UnitType,
      pieces_per_unit: ppu,
      buy_price:       buyPerPc,
      sell_price:      userSellPrice,
      sell_price_piece: ppu > 1 && userSellPrice > 0 ? Math.round(userSellPrice / ppu) : null,
      category:        item.editCategory || null,
      vat_class:       item.vat_class || 'A',
      supplier_name:   supplierName.trim() || null,
      supplier_id:     supplierId,
      min_stock:       5,
    }).select('id').single()

    if (error || !data) throw new Error(`Failed to create product: ${item.name}`)
    return data.id
  }

  // ── Drop zone handlers ────────────────────────────────────
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // ── Success screen ────────────────────────────────────────
  if (saved) {
    const count = isManual ? validManualItems.length : activePdfItems.length
    return (
      <div className="p-4 max-w-[1209px] mx-auto">
        <div className="bg-white rounded-xl p-8 text-center space-y-3" style={{ boxShadow: SHADOW }}>
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
            style={{ background: '#E3F3EC' }}>
            <Check size={32} color={SUCCESS} strokeWidth={2.5} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: '#1E1626' }}>Stock Received</h2>
          <p className="text-sm" style={{ color: MUTED }}>
            {count} product{count !== 1 ? 's' : ''} added to inventory from {supplierName}
          </p>
        </div>
      </div>
    )
  }

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4 max-w-[1209px] mx-auto">

      <h1 className="text-lg font-bold" style={{ color: '#1E1626' }}>Add Stock</h1>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-2"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertTriangle size={16} color={DANGER} className="mt-0.5 flex-shrink-0" />
          <div className="text-sm" style={{ color: DANGER }}>{error}</div>
          <button onClick={() => setError('')} className="ml-auto flex-shrink-0">
            <X size={14} color={DANGER} />
          </button>
        </div>
      )}

      {/* ── Tab switcher ── */}
      <div className="flex p-1 rounded-xl" style={{ background: '#F0ECF5', gap: 4 }}>
        {(['manual', 'receipt'] as const).map(t => (
          <button key={t} type="button"
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold transition active:scale-[0.98]"
            style={{
              background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? PRIMARY : MUTED,
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            {t === 'manual' ? (
              <span className="flex items-center justify-center gap-1.5">
                <ClipboardList size={15} /> Manual Entry
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <FileText size={15} /> PDF Receipt
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Supplier (shared) ── */}
      <div className="bg-white rounded-xl p-4" style={{ boxShadow: SHADOW }}>
        <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: MUTED }}>
          Supplier
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-1 block" style={{ color: '#475569' }}>
              Supplier Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              list="supplier-list"
              value={supplierName}
              onChange={e => {
                setSupplierName(e.target.value)
                const match = suppliers.find(s => s.name.toLowerCase() === e.target.value.toLowerCase())
                if (match?.phone) setSupplierPhone(match.phone)
              }}
              placeholder="e.g. KHETIA'S"
              className={INP}
              style={{ fontWeight: 600 }}
            />
            <datalist id="supplier-list">
              {suppliers.map(s => <option key={s.id} value={s.name} />)}
            </datalist>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-1 block" style={{ color: '#475569' }}>
              Phone
            </label>
            <input
              value={supplierPhone}
              onChange={e => setSupplierPhone(e.target.value)}
              placeholder="Optional"
              className={INP}
            />
          </div>
        </div>
      </div>

      {/* ── MANUAL TAB ── */}
      {tab === 'manual' && (
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: SHADOW }}>
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid #E8E3ED' }}>
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>
              Items ({validManualItems.length})
            </div>
            <button
              onClick={addManualRow}
              className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition active:scale-95"
              style={{ background: '#F6F0FC', color: PRIMARY }}>
              <Plus size={13} /> Add Row
            </button>
          </div>

          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F7F4FA', borderBottom: '2px solid #E8E3ED' }}>
                  {[
                    ['Code',       'left',   80],
                    ['Item Name',  'left',   200],
                    ['Category',   'left',   130],
                    ['Unit',       'center', 70],
                    ['PPU',        'center', 55],
                    ['Qty',        'center', 65],
                    ['Cost',       'right',  90],
                    ['Amount',     'right',  90],
                    ['Sell Price', 'right',  90],
                    ['',           'center', 36],
                  ].map(([label, align, w]) => (
                    <th key={String(label)} style={{
                      textAlign: align as 'left' | 'right' | 'center',
                      width: Number(w), padding: '8px 6px',
                      fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: '#6B6373', whiteSpace: 'nowrap',
                    }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {manualItems.map((item, idx) => {
                  const rawQty  = parseFloat(item.qty) || 0
                  const rawCost = parseFloat(item.cost) || 0
                  const lineAmt = rawQty * rawCost
                  const isMatch = !!item.matchedProduct
                  const rowBg   = isMatch ? '#F6FFF9' : idx % 2 === 0 ? '#fff' : '#FAFAFB'

                  return (
                    <tr key={idx} style={{ background: rowBg, borderBottom: '1px solid #F0EBF5' }}>
                      {/* Code */}
                      <td style={{ padding: '4px 6px' }}>
                        <input value={item.code}
                          onChange={e => updateManual(idx, { code: e.target.value })}
                          placeholder="SKU"
                          style={{
                            width: '100%', padding: '4px 6px', border: '1px solid #E2E8F0',
                            borderRadius: 4, fontSize: 12, fontFamily: 'monospace', background: 'white',
                          }} />
                      </td>
                      {/* Item name */}
                      <td style={{ padding: '4px 6px' }}>
                        <input value={item.name}
                          onChange={e => updateManual(idx, { name: e.target.value })}
                          placeholder="Product name"
                          style={{
                            width: '100%', padding: '4px 6px', border: '1px solid #E2E8F0',
                            borderRadius: 4, fontSize: 12, fontWeight: 600, background: 'white',
                          }} />
                        {isMatch && (
                          <div className="text-[10px] font-bold mt-0.5" style={{ color: SUCCESS }}>
                            ✓ Matched
                          </div>
                        )}
                      </td>
                      {/* Category */}
                      <td style={{ padding: '4px 6px' }}>
                        <select value={item.category}
                          onChange={e => updateManual(idx, { category: e.target.value })}
                          style={{
                            width: '100%', fontSize: 11, padding: '4px 4px', borderRadius: 4,
                            border: '1px solid #E2E8F0', background: 'white',
                            color: item.category ? '#1E1626' : MUTED,
                          }}>
                          <option value="">—</option>
                          {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      {/* Unit type */}
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <select value={item.unit_type}
                          onChange={e => {
                            const ut = e.target.value as UnitType
                            updateManual(idx, { unit_type: ut, ppu: ut === 'PC' ? '1' : item.ppu })
                          }}
                          style={{
                            fontSize: 11, padding: '4px 2px', borderRadius: 4,
                            border: '1px solid #E2E8F0', background: 'white', fontWeight: 700,
                          }}>
                          {UNIT_TYPES.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      {/* PPU */}
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <input type="number" min="1" value={item.ppu}
                          onChange={e => updateManual(idx, { ppu: e.target.value })}
                          disabled={item.unit_type === 'PC'}
                          style={{
                            width: 44, textAlign: 'center', padding: '4px 4px',
                            border: '1px solid #E2E8F0', borderRadius: 4,
                            fontSize: 12, fontWeight: 600, background: item.unit_type === 'PC' ? '#F5F5F5' : 'white',
                          }} />
                      </td>
                      {/* Qty */}
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <input type="number" min="0.5" step="0.5" inputMode="decimal"
                          value={item.qty}
                          onChange={e => updateManual(idx, { qty: e.target.value })}
                          placeholder="0"
                          style={{
                            width: 55, textAlign: 'center', padding: '4px 4px',
                            border: '1px solid #E2E8F0', borderRadius: 4,
                            fontSize: 13, fontWeight: 700, background: 'white',
                          }} />
                      </td>
                      {/* Cost */}
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                        <input type="number" min="0" step="0.01" inputMode="decimal"
                          value={item.cost}
                          onChange={e => updateManual(idx, { cost: e.target.value })}
                          placeholder="0"
                          style={{
                            width: 80, textAlign: 'right', padding: '4px 6px',
                            border: '1px solid #E2E8F0', borderRadius: 4,
                            fontSize: 12, fontWeight: 600, background: 'white',
                          }} />
                      </td>
                      {/* Amount (calculated) */}
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                        <span className="tabnum font-bold" style={{ fontSize: 13, color: lineAmt > 0 ? PRIMARY : MUTED }}>
                          {lineAmt > 0 ? fmt(lineAmt) : '—'}
                        </span>
                      </td>
                      {/* Sell price */}
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                        <input type="number" min="0" step="1" inputMode="decimal"
                          value={item.sellPrice}
                          onChange={e => updateManual(idx, { sellPrice: e.target.value })}
                          placeholder={rawCost > 0 ? String(Math.ceil(rawCost * 1.1)) : '0'}
                          style={{
                            width: 80, textAlign: 'right', padding: '4px 6px',
                            border: '1px solid #E2E8F0', borderRadius: 4,
                            fontSize: 12, fontWeight: 700, background: 'white',
                            color: parseFloat(item.sellPrice) > 0 ? SUCCESS : '#111',
                          }} />
                      </td>
                      {/* Delete */}
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <button onClick={() => removeManualRow(idx)}
                          className="w-6 h-6 rounded flex items-center justify-center"
                          style={{ color: manualItems.length > 1 ? DANGER : '#ddd' }}
                          disabled={manualItems.length <= 1}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Add another row bar */}
          <div style={{ borderTop: '1px solid #E8E3ED', padding: '8px 16px' }}>
            <button onClick={addManualRow}
              className="w-full py-2 rounded-lg text-xs font-bold transition active:scale-95"
              style={{ background: '#F6F0FC', color: PRIMARY, border: `1px dashed #D1C4E9` }}>
              <Plus size={13} className="inline mr-1" /> Add Another Item
            </button>
          </div>
        </div>
      )}

      {/* ── PDF TAB ── */}
      {tab === 'receipt' && !receipt && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="bg-white rounded-xl p-8 cursor-pointer transition-all hover:border-[#5B2A86]"
          style={{ boxShadow: SHADOW, border: '2px dashed #E8E3ED', textAlign: 'center' }}>
          <input ref={fileRef} type="file" accept=".pdf"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            className="hidden" />
          {uploading ? (
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center"
                style={{ background: '#F6F0FC' }}>
                <FileText size={24} color={PRIMARY} className="animate-pulse" />
              </div>
              <p className="text-sm font-semibold" style={{ color: PRIMARY }}>Parsing {fileName}...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
                style={{ background: '#F6F0FC' }}>
                <Upload size={28} color={PRIMARY} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#1E1626' }}>Drop supplier receipt PDF here</p>
                <p className="text-xs mt-1" style={{ color: MUTED }}>or click to browse · PDF only</p>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'receipt' && receipt && (
        <>
          {/* Receipt info strip */}
          <div className="bg-white rounded-xl p-4 flex items-center justify-between" style={{ boxShadow: SHADOW }}>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider"
                style={{ color: receipt.receipt.type === 'credit_note' ? DANGER : SUCCESS }}>
                {receipt.receipt.type === 'cash_sale' ? 'Cash Sale' :
                 receipt.receipt.type === 'credit_note' ? 'Credit Note' : receipt.receipt.type}
              </span>
              <span className="text-sm font-bold ml-2" style={{ color: PRIMARY }}>
                #{receipt.receipt.number}
              </span>
              <span className="text-xs ml-2" style={{ color: MUTED }}>{receipt.receipt.date}</span>
            </div>
            <button
              onClick={() => { setReceipt(null); setPdfItems([]) }}
              className="text-xs font-bold px-3 py-1.5 rounded-lg transition"
              style={{ background: '#F6F0FC', color: PRIMARY }}>
              Upload different
            </button>
          </div>

          {/* PDF Items table */}
          <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: SHADOW }}>
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid #E8E3ED' }}>
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>
                Items ({activePdfItems.length} of {pdfItems.length})
              </div>
              <div className="text-xs" style={{ color: MUTED }}>
                <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ background: '#E3F3EC' }} /> Existing
                <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1 ml-3" style={{ background: '#EBF5FF' }} /> New
                <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1 ml-3" style={{ background: '#F5F5F5' }} /> Voided
              </div>
            </div>

            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F7F4FA', borderBottom: '2px solid #E8E3ED' }}>
                    {[
                      ['',         'center', 36],
                      ['Code',     'left',   70],
                      ['Product',  'left',   200],
                      ['Category', 'left',   130],
                      ['Unit',     'center', 60],
                      ['PPU',      'center', 55],
                      ['Qty',      'center', 55],
                      ['Cost',     'right',  85],
                      ['Amount',   'right',  90],
                      ['Sell Price','right',  120],
                    ].map(([label, align, w]) => (
                      <th key={String(label)} style={{
                        textAlign: align as 'left' | 'right' | 'center',
                        width: Number(w), padding: '8px 6px',
                        fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
                        textTransform: 'uppercase', color: '#6B6373', whiteSpace: 'nowrap',
                      }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pdfItems.map((item, idx) => {
                    const isVoided = item.voided
                    const isNew    = !item.matchedProduct
                    const rowBg    = isVoided ? '#F9F9F9' : isNew ? '#F7FBFF' : '#F6FFF9'
                    const minSell  = Math.ceil(item.rate * 1.1)

                    return (
                      <tr key={idx} style={{
                        background: rowBg, borderBottom: '1px solid #F0EBF5',
                        opacity: isVoided ? 0.5 : 1,
                        textDecoration: isVoided ? 'line-through' : 'none',
                      }}>
                        {/* Checkbox */}
                        <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                          {!isVoided ? (
                            <input type="checkbox" checked={item.include}
                              onChange={e => updatePdfItem(idx, { include: e.target.checked })}
                              style={{ accentColor: PRIMARY }} />
                          ) : (
                            <span style={{ fontSize: 10, color: DANGER, fontWeight: 700 }}>VO</span>
                          )}
                        </td>
                        {/* Code */}
                        <td style={{ padding: '6px 6px' }}>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: MUTED }}>
                            {item.code || '—'}
                          </span>
                        </td>
                        {/* Product name */}
                        <td style={{ padding: '6px 6px' }}>
                          <div className="font-semibold text-sm" style={{ color: '#1E1626' }}>{item.name}</div>
                          {item.pack_size && <div className="text-xs" style={{ color: MUTED }}>{item.pack_size}</div>}
                          {item.matchedProduct && (
                            <div className="text-[10px] font-bold" style={{ color: SUCCESS }}>✓ Matched</div>
                          )}
                          {!item.matchedProduct && !isVoided && (
                            <div className="text-[10px] font-bold" style={{ color: '#3B82F6' }}>+ New product</div>
                          )}
                        </td>
                        {/* Category */}
                        <td style={{ padding: '6px 6px' }}>
                          {!isVoided ? (
                            <select value={item.editCategory}
                              onChange={e => updatePdfItem(idx, { editCategory: e.target.value })}
                              style={{
                                fontSize: 11, padding: '2px 4px', borderRadius: 4,
                                border: '1px solid #E2E8F0', background: 'white',
                                color: item.editCategory ? '#1E1626' : MUTED, maxWidth: 120,
                              }}>
                              <option value="">—</option>
                              {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : <span style={{ color: MUTED, fontSize: 11 }}>—</span>}
                        </td>
                        {/* Unit */}
                        <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: '#EDE4F5', color: PRIMARY }}>
                            {item.unit_type}
                          </span>
                        </td>
                        {/* PPU */}
                        <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                          {!isVoided ? (
                            <input type="number" min="1" value={item.ppu}
                              onChange={e => updatePdfItem(idx, { ppu: e.target.value })}
                              style={{
                                width: 44, textAlign: 'center', padding: '2px 4px',
                                border: '1px solid #E2E8F0', borderRadius: 4,
                                fontSize: 12, fontWeight: 600, background: 'white',
                              }} />
                          ) : <span className="tabnum" style={{ fontSize: 12 }}>{item.ppu}</span>}
                        </td>
                        {/* Qty */}
                        <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                          <span className="tabnum font-semibold" style={{ fontSize: 13 }}>{item.qty}</span>
                        </td>
                        {/* Cost/Rate */}
                        <td style={{ padding: '6px 6px', textAlign: 'right' }}>
                          <span className="tabnum" style={{ fontSize: 13, color: '#374151' }}>{fmt(item.rate)}</span>
                        </td>
                        {/* Amount */}
                        <td style={{ padding: '6px 6px', textAlign: 'right' }}>
                          <span className="tabnum font-bold" style={{ fontSize: 13, color: PRIMARY }}>{fmt(item.amount)}</span>
                        </td>
                        {/* Sell Price */}
                        <td style={{ padding: '6px 6px', textAlign: 'right' }}>
                          {isVoided ? (
                            <span style={{ color: MUTED, fontSize: 11 }}>—</span>
                          ) : item.editingPrice ? (
                            <input autoFocus type="number" min={minSell} step="1"
                              value={item.sellPrice}
                              onChange={e => updatePdfItem(idx, { sellPrice: e.target.value })}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const val = parseFloat(item.sellPrice)
                                  if (val > 0 && val < minSell) updatePdfItem(idx, { sellPrice: String(minSell) })
                                  updatePdfItem(idx, { editingPrice: false })
                                }
                                if (e.key === 'Escape') updatePdfItem(idx, { editingPrice: false, sellPrice: '' })
                              }}
                              onBlur={() => {
                                const val = parseFloat(item.sellPrice)
                                if (val > 0 && val < minSell) updatePdfItem(idx, { sellPrice: String(minSell) })
                                updatePdfItem(idx, { editingPrice: false })
                              }}
                              placeholder={String(minSell)}
                              style={{
                                width: 75, textAlign: 'right', padding: '3px 6px',
                                border: `2px solid ${PRIMARY}`, borderRadius: 6,
                                fontSize: 12, fontWeight: 700, outline: 'none',
                              }} />
                          ) : (
                            <div>
                              {parseFloat(item.sellPrice) > 0 ? (
                                <button onClick={() => updatePdfItem(idx, { editingPrice: true })}
                                  className="tabnum font-bold"
                                  style={{ fontSize: 13, color: SUCCESS, background: 'none', border: 'none', cursor: 'pointer' }}>
                                  {fmt(parseFloat(item.sellPrice))}
                                </button>
                              ) : (
                                <button onClick={() => updatePdfItem(idx, { editingPrice: true })}
                                  className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md transition"
                                  style={{ background: '#FEF2F2', color: DANGER, border: '1px solid #FECACA', marginLeft: 'auto' }}>
                                  <Tag size={10} /> Set Price
                                </button>
                              )}
                              <div className="text-[9px] mt-0.5" style={{ color: MUTED }}>min {fmt(minSell)}</div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Payment + Confirm (shared) ── */}
      {((tab === 'manual' && validManualItems.length > 0) || (tab === 'receipt' && receipt && activePdfItems.length > 0)) && (
        <div className="rounded-xl p-4 space-y-4" style={{ background: '#1E1626' }}>
          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: '#C9A8E0' }}>Items</span>
              <span className="tabnum text-white font-bold">
                {isManual ? validManualItems.length : activePdfItems.length}
              </span>
            </div>
            {!isManual && pdfDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: '#C9A8E0' }}>Discount</span>
                <span className="tabnum font-bold" style={{ color: '#FCD34D' }}>−KES {fmt(pdfDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2" style={{ borderTop: '1px solid #3D3448' }}>
              <span className="text-sm font-bold" style={{ color: '#C9A8E0' }}>Total</span>
              <span className="tabnum text-xl font-bold text-white">KES {fmt(finalTotal)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#6B6373' }}>
              How did you pay?
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['cash', 'mpesa', 'credit'] as const).map(m => (
                <button key={m} type="button"
                  onClick={() => { setPayMethod(m); if (m === 'credit') setPaidAmount('0') }}
                  className="py-2.5 rounded-lg text-sm font-bold border transition"
                  style={{
                    background: payMethod === m ? '#5B2A86' : '#2D2438',
                    color: payMethod === m ? '#fff' : '#9CA3AF',
                    border: `1.5px solid ${payMethod === m ? '#5B2A86' : '#3D3448'}`,
                  }}>
                  {m === 'cash' ? 'Cash' : m === 'mpesa' ? 'M-Pesa' : 'On Credit'}
                </button>
              ))}
            </div>
          </div>

          {/* Amount paid */}
          {payMethod !== 'credit' && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#6B6373' }}>
                Amount Paid (KES)
              </div>
              <input type="number" min="0" step="0.01" inputMode="decimal"
                value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)}
                placeholder={fmt(finalTotal)}
                className="w-full px-3 py-2.5 bg-[#2D2438] border border-[#3D3448] rounded-lg text-sm font-bold text-white placeholder:text-[#6B6373] focus:outline-none focus:border-[#5B2A86] transition" />
              {outstanding > 0.005 && (
                <div className="mt-2 rounded-lg px-3 py-2 text-xs font-semibold"
                  style={{ background: '#3D2A00', color: '#FCD34D' }}>
                  KES {fmt(outstanding)} still outstanding to supplier
                </div>
              )}
            </div>
          )}

          {/* M-Pesa ref */}
          {payMethod === 'mpesa' && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#6B6373' }}>
                M-Pesa Reference
              </div>
              <input value={mpesaRef} onChange={e => setMpesaRef(e.target.value)}
                placeholder="e.g. SHG7..."
                className="w-full px-3 py-2 bg-[#2D2438] border border-[#3D3448] rounded-lg text-sm text-white placeholder:text-[#6B6373] focus:outline-none focus:border-[#5B2A86] transition" />
            </div>
          )}

          {/* On credit note */}
          {isCredit && (
            <div className="rounded-lg px-3 py-2 text-xs font-semibold"
              style={{ background: '#3D2A00', color: '#FCD34D' }}>
              Full amount KES {fmt(finalTotal)} recorded as owed to supplier
            </div>
          )}

          {/* Confirm button */}
          <button onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-xl text-base font-bold disabled:opacity-40 active:scale-95 transition"
            style={{ background: SUCCESS, color: '#fff' }}>
            {saving ? 'Saving…' : `Confirm & Save Stock — KES ${fmt(finalTotal)}`}
          </button>
        </div>
      )}
    </div>
  )
}
