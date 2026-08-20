'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, StockEntry, isMultiUnit, UNIT_LABELS, UnitType, getEffectiveSellPrice, getEffectiveSellPricePiece } from '@/lib/types'
import { fmt, fmtDateTime } from '@/lib/utils'
import { Search, Package, AlertTriangle, ChevronLeft, PackagePlus, History, X } from 'lucide-react'

import { ProductForm, FormState, emptyForm } from '@/components/products/ProductForm'
import { StockInForm, StockForm, emptyStock } from '@/components/products/StockInForm'

const C = {
  bg: '#FAF8FB',
  surface: '#FFFFFF',
  fg: '#1E1626',
  primary: '#5B2A86',
  primaryHover: '#4A2270',
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
  shadow: '0 1px 3px rgba(0,0,0,0.06)',
} as const

function EditableCell({ editing, value, onChange, onCommit, onCancel, saving: cellSaving, displayValue, displayColor, editHint, sub }: {
  editing: boolean; value: string; onChange: (v: string) => void; onCommit: () => void; onCancel: () => void
  saving: boolean; displayValue: string; displayColor: string; editHint?: string; sub?: string
}) {
  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <input autoFocus type="number" min="0" step="0.01" value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
          onBlur={onCommit}
          style={{
            width: 80, textAlign: 'right', padding: '4px 6px',
            border: `2px solid ${C.primary}`, borderRadius: 8,
            fontSize: 13, fontWeight: 800, outline: 'none',
            background: '#fff', color: C.fg,
          }} />
        {cellSaving && <span style={{ fontSize: 10, color: C.muted }}>...</span>}
      </div>
    )
  }
  return (
    <>
      <span className="tabnum font-bold" style={{ color: displayColor, fontSize: 13 }}>
        {displayValue}
      </span>
      {sub && <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{sub}</div>}
    </>
  )
}

export default function ProductsPage() {
  const supabase = createClient()
  const PAGE_SIZE = 50

  const [products, setProducts] = useState<Product[]>([])
  const [entries, setEntries] = useState<StockEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [search, setSearch] = useState('')

  const [saving, setSaving] = useState(false)
  const [stockSaving, setStockSaving] = useState(false)
  const [stockSuccess, setStockSuccess] = useState('')

  // Inline editing
  const [editCost, setEditCost] = useState<{ id: string; value: string } | null>(null)
  const [savingCost, setSavingCost] = useState(false)
  const [editSell, setEditSell] = useState<{ id: string; value: string } | null>(null)
  const [savingSell, setSavingSell] = useState(false)
  const [editCostPc, setEditCostPc] = useState<{ id: string; value: string } | null>(null)
  const [savingCostPc, setSavingCostPc] = useState(false)
  const [editSellPc, setEditSellPc] = useState<{ id: string; value: string } | null>(null)
  const [savingSellPc, setSavingSellPc] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [summary, setSummary] = useState({
    totalProducts: 0,
    inventoryCost: 0,
    totalSuppliers: 0,
    supplierDebt: 0,
  })

  useEffect(() => { loadSummary() }, []) // eslint-disable-line
  useEffect(() => {
    if (search === '') {
      loadProducts(false)
      return
    }
    const t = setTimeout(() => loadProducts(false), 300)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line

  async function loadProducts(append = false) {
    if (!append) setLoading(true); else setLoadingMore(true)
    const start = append ? products.length : 0
    let q = supabase.from('products').select('*').eq('is_active', true).order('name').range(start, start + PAGE_SIZE - 1)
    if (search.trim()) {
      const s = `%${search.trim()}%`
      q = q.or(`name.ilike.${s},brand.ilike.${s},category.ilike.${s},size.ilike.${s},code.ilike.${s}`)
    }
    const { data } = await q
    const rows = (data ?? []) as Product[]
    if (append) setProducts(prev => [...prev, ...rows]); else setProducts(rows)
    setHasMore(rows.length === PAGE_SIZE)
    if (!append) setLoading(false); else setLoadingMore(false)
  }

  async function loadSummary() {
    const [{ data: allProducts }, { data: purchaseOrders }] = await Promise.all([
      supabase.from('products').select('buy_price,stock_qty,supplier_name').eq('is_active', true),
      supabase.from('purchase_orders').select('total_amount,paid_amount'),
    ])
    const rows = allProducts ?? []
    const totalProducts = rows.length
    const inventoryCost = rows.reduce((s, r) => s + Number(r.buy_price) * Number(r.stock_qty), 0)
    const supplierNames = new Set(rows.map(r => r.supplier_name).filter(Boolean))
    const totalSuppliers = supplierNames.size
    const supplierDebt = (purchaseOrders ?? []).reduce(
      (s, r) => s + Math.max(0, Number(r.total_amount) - Number(r.paid_amount)), 0
    )
    setSummary({ totalProducts, inventoryCost, totalSuppliers, supplierDebt })
  }

  async function loadEntries(productId: string) {
    const { data } = await supabase.from('stock_entries')
      .select('*, products(name, unit_type, size)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(10)
    setEntries((data ?? []) as StockEntry[])
  }

  async function handleSaveProduct(form: FormState) {
    if (!form.name || !form.sell_price) return
    setSaving(true)

    const ppu = parseInt(form.pieces_per_unit) || 1
    const multi = isMultiUnit({ pieces_per_unit: ppu })
    const rawBuyPrice = parseFloat(form.buy_price) || 0
    const buyPricePerPiece = multi && ppu > 1 ? rawBuyPrice / ppu : rawBuyPrice

    let sellPrice = parseFloat(form.sell_price) || 0
    let sellPricePiece: number | null = null
    if (multi) {
      const rawPiecePrice = parseFloat(form.sell_price_piece) || 0
      if (form.price_mode === 'unit') {
        sellPricePiece = rawPiecePrice > 0 ? rawPiecePrice : (ppu > 0 ? Math.round(sellPrice / ppu) : 0)
      } else {
        sellPricePiece = sellPrice
        sellPrice = rawPiecePrice > 0 ? rawPiecePrice : sellPricePiece * ppu
      }
    }

    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      brand: form.brand.trim() || null,
      category: form.category || null,
      size: form.size.trim() || null,
      unit_type: form.unit_type,
      pieces_per_unit: ppu,
      buy_price: buyPricePerPiece,
      sell_price: sellPrice,
      sell_price_piece: multi ? sellPricePiece : null,
      min_stock: parseFloat(form.min_stock) || 5,
      supplier_name: form.supplier_name.trim() || null,
    }

    if (selectedProduct && view === 'detail') {
      await supabase.from('products').update(payload).eq('id', selectedProduct.id)
    } else {
      const { data: inserted } = await supabase.from('products').insert(payload).select('id').single()
      const openingQty = parseInt(form.opening_qty) || 0
      if (openingQty > 0 && inserted?.id) {
        const piecesQty = multi ? openingQty * ppu : openingQty
        await supabase.from('stock_entries').insert({
          product_id: inserted.id, quantity: piecesQty,
          buy_price: buyPricePerPiece, supplier: form.supplier_name.trim() || null,
        })
      }
    }

    await loadProducts(false)
    setSaving(false)
    setView('list')
    setSelectedProduct(null)
  }

  async function handleStockIn(form: StockForm) {
    if (!selectedProduct || !form.quantity) return
    setStockSaving(true)
    const qty = parseFloat(form.quantity)
    const buyPerPiece = parseFloat(form.buy_price) || selectedProduct.buy_price

    await supabase.from('stock_entries').insert({
      product_id: selectedProduct.id, quantity: qty,
      buy_price: buyPerPiece, supplier: form.supplier.trim() || selectedProduct.supplier_name || null,
    })

    setStockSuccess(`Added ${qty} pcs to ${selectedProduct.name}`)
    setTimeout(() => setStockSuccess(''), 4000)

    await loadProducts(false)
    await loadEntries(selectedProduct.id)
    const { data } = await supabase.from('products').select('*').eq('id', selectedProduct.id).single()
    if (data) setSelectedProduct(data as Product)
    setStockSaving(false)
  }

  function openProduct(p: Product) {
    setSelectedProduct(p)
    setView('detail')
    loadEntries(p.id)
  }

  function getFormFromProduct(p: Product): FormState {
    const multi = isMultiUnit(p)
    const ppu = p.pieces_per_unit || 1
    return {
      name: p.name, code: p.code ?? '', brand: p.brand ?? '',
      category: p.category ?? '', size: p.size ?? '',
      unit_type: p.unit_type, pieces_per_unit: String(ppu),
      buy_price: multi && ppu > 1 ? String(Math.round(p.buy_price * ppu)) : String(p.buy_price),
      sell_price: String(p.sell_price),
      sell_price_piece: p.sell_price_piece != null ? String(p.sell_price_piece) : '',
      price_mode: 'unit', min_stock: String(p.min_stock),
      supplier_name: p.supplier_name ?? '', opening_qty: '',
    }
  }

  // ── Inline commit handlers ────────────────────────────────────────────────

  async function commitCost(p: Product) {
    if (!editCost || editCost.id !== p.id) return
    const raw = parseFloat(editCost.value)
    if (isNaN(raw) || raw < 0) { setEditCost(null); return }
    const ppu = p.pieces_per_unit || 1
    const multi = isMultiUnit(p)
    const perPiece = multi && ppu > 1 ? raw / ppu : raw
    setSavingCost(true)
    await supabase.from('products').update({ buy_price: perPiece }).eq('id', p.id)
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, buy_price: perPiece } : x))
    setSavingCost(false)
    setEditCost(null)
  }

  async function commitCostPc(p: Product) {
    if (!editCostPc || editCostPc.id !== p.id) return
    const raw = parseFloat(editCostPc.value)
    if (isNaN(raw) || raw < 0) { setEditCostPc(null); return }
    setSavingCostPc(true)
    await supabase.from('products').update({ buy_price: raw }).eq('id', p.id)
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, buy_price: raw } : x))
    setSavingCostPc(false)
    setEditCostPc(null)
  }

  async function commitSell(p: Product) {
    if (!editSell || editSell.id !== p.id) return
    const raw = parseFloat(editSell.value)
    if (isNaN(raw) || raw < 0) { setEditSell(null); return }
    const ppu = p.pieces_per_unit || 1
    const multi = isMultiUnit(p)
    const sellPricePiece = multi && ppu > 1 ? Math.round(raw / ppu) : null
    const update: Record<string, number | null> = { sell_price: raw }
    if (multi) update.sell_price_piece = sellPricePiece
    setSavingSell(true)
    await supabase.from('products').update(update).eq('id', p.id)
    setProducts(prev => prev.map(x =>
      x.id === p.id ? { ...x, sell_price: raw, ...(multi ? { sell_price_piece: sellPricePiece } : {}) } : x
    ))
    setSavingSell(false)
    setEditSell(null)
  }

  async function commitSellPc(p: Product) {
    if (!editSellPc || editSellPc.id !== p.id) return
    const raw = parseFloat(editSellPc.value)
    if (isNaN(raw) || raw < 0) { setEditSellPc(null); return }
    const ppu = p.pieces_per_unit || 1
    const multi = isMultiUnit(p)
    // When user edits sell/pc, also update the unit sell_price to stay consistent
    const newSellPrice = multi && ppu > 1 ? raw * ppu : raw
    const update: Record<string, number | null> = {
      sell_price_piece: raw,
      sell_price: newSellPrice,
    }
    setSavingSellPc(true)
    await supabase.from('products').update(update).eq('id', p.id)
    setProducts(prev => prev.map(x =>
      x.id === p.id ? { ...x, sell_price: newSellPrice, sell_price_piece: raw } : x
    ))
    setSavingSellPc(false)
    setEditSellPc(null)
  }

  async function handleDelete(p: Product) {
    if (deleteConfirm !== p.id) { setDeleteConfirm(p.id); return }
    setDeleting(true)
    await supabase.from('products').update({ is_active: false }).eq('id', p.id)
    setProducts(prev => prev.filter(x => x.id !== p.id))
    setSummary(s => ({ ...s, totalProducts: s.totalProducts - 1 }))
    setDeleteConfirm(null)
    setDeleting(false)
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="p-4 max-w-[1280px] mx-auto">
      <div className="animate-pulse space-y-3">
        <div className="h-10 rounded-xl" style={{ background: C.border }} />
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 rounded-lg" style={{ background: C.border, opacity: 0.5 }} />)}
      </div>
    </div>
  )

  // ── Detail View ───────────────────────────────────────────────────────────
  if (view === 'detail' && selectedProduct) {
    const p = selectedProduct
    const multi = isMultiUnit(p)
    const ppu = p.pieces_per_unit || 1
    const isLow = p.stock_qty <= p.min_stock
    const unitLbl = UNIT_LABELS[p.unit_type as UnitType] || p.unit_type

    return (
      <div className="p-4 space-y-4 max-w-[1280px] mx-auto">
        <button onClick={() => { setView('list'); setSelectedProduct(null); setEntries([]) }}
          className="flex items-center gap-1.5 text-sm font-black active:scale-95 transition-transform"
          style={{ color: C.primary }}>
          <ChevronLeft size={16} strokeWidth={2.5} /> Products
        </button>

        {/* Product header */}
        <div className="rounded-xl p-4" style={{ background: C.surface, boxShadow: C.shadow }}>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black flex-shrink-0"
              style={{ background: isLow ? C.dangerLight : C.primaryLight, color: isLow ? C.danger : C.primary }}>
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-black text-base" style={{ color: C.fg }}>
                {p.brand && <span style={{ color: C.muted, fontWeight: 500 }}>{p.brand} </span>}
                {p.name}
                {p.size && <span style={{ color: C.muted, fontWeight: 500 }}> {p.size}</span>}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {p.code && (
                  <span className="tabnum" style={{ fontSize: 10, fontWeight: 800, fontFamily: 'var(--font-mono)', padding: '1px 8px', borderRadius: 6, background: C.primaryLight, color: C.primary }}>
                    {p.code}
                  </span>
                )}
                {p.category && <span className="text-xs font-semibold" style={{ color: C.muted }}>{p.category}</span>}
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { label: 'Stock', value: p.stock_qty, sub: 'pcs', color: isLow ? C.danger : C.fg },
              { label: multi ? `${unitLbl} Price` : 'Sell Price', value: fmt(getEffectiveSellPrice(p)), sub: 'KES', color: C.primary },
              { label: 'Cost/Piece', value: fmt(p.buy_price), sub: 'KES', color: C.fg },
              { label: 'Sell/Piece', value: fmt(getEffectiveSellPricePiece(p)), sub: 'KES', color: C.success },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="rounded-lg p-2.5 text-center" style={{ background: C.bg, border: `1.5px solid ${C.border}` }}>
                <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: C.muted }}>{label}</div>
                <div className="font-black text-lg tabnum mt-0.5" style={{ color }}>{value}</div>
                <div className="text-[9px] font-semibold" style={{ color: C.muted }}>{sub}</div>
              </div>
            ))}
          </div>

          {multi && (
            <div className="mt-3 rounded-lg px-3 py-2.5 text-xs text-center font-bold"
              style={{ background: C.warningLight, border: `1.5px solid #E8D5A8`, color: C.warning }}>
              {ppu} pcs per {unitLbl.toLowerCase()} · Cost {fmt(p.buy_price)}/pc · Sell {fmt(getEffectiveSellPrice(p))}/{unitLbl.toLowerCase()} or {fmt(getEffectiveSellPricePiece(p))}/pc
            </div>
          )}
        </div>

        {/* Add Stock */}
        <div className="rounded-xl p-4" style={{ background: C.surface, boxShadow: C.shadow }}>
          <div className="flex items-center gap-2 font-black text-sm mb-4" style={{ color: C.primary }}>
            <PackagePlus size={16} /> Add Stock
          </div>
          <StockInForm product={p} onSave={handleStockIn} saving={stockSaving} success={stockSuccess} />
        </div>

        {/* Edit product */}
        <div className="rounded-xl p-4" style={{ background: C.surface, boxShadow: C.shadow }}>
          <div className="flex items-center gap-2 font-bold text-sm mb-3" style={{ color: C.muted }}>
            <Package size={16} /> Edit Product Details
          </div>
          <ProductForm initial={getFormFromProduct(p)} onSave={handleSaveProduct} saving={saving} />
        </div>

        {/* Stock history */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <History size={16} style={{ color: C.muted }} />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Stock History</span>
          </div>
          {entries.length === 0 ? (
            <div className="text-center py-8 text-sm font-semibold" style={{ color: C.muted }}>No stock entries yet</div>
          ) : (
            <div className="space-y-2">
              {entries.map(e => (
                <div key={e.id} className="rounded-xl p-3 flex items-center justify-between" style={{ background: C.surface, boxShadow: C.shadow }}>
                  <div className="text-xs font-semibold" style={{ color: C.muted }}>
                    {fmtDateTime(e.created_at)}{e.supplier && ` · ${e.supplier}`}
                  </div>
                  <div className="text-right">
                    <div className="font-black text-sm tabnum" style={{ color: C.success }}>+{e.quantity} pcs</div>
                    <div className="text-xs tabnum font-semibold" style={{ color: C.muted }}>@ {fmt(e.buy_price)}/pc</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Inline editable cell (extracted to module scope) ──────────────────────

  // ── List View ─────────────────────────────────────────────────────────────
  return (
    <div className="p-3 space-y-3 max-w-[1280px] mx-auto">

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Products', value: summary.totalProducts.toLocaleString(), sub: 'active SKUs', accent: C.primary, bg: C.primaryLight, href: null },
          { label: 'Inventory Cost', value: `${fmt(summary.inventoryCost)}`, sub: 'at buy price', accent: C.fg, bg: '#F1F3F5', href: null },
          { label: 'Suppliers', value: summary.totalSuppliers.toLocaleString(), sub: 'unique', accent: C.success, bg: C.successLight, href: '/purchases' },
          { label: 'Owed', value: `${fmt(summary.supplierDebt)}`, sub: 'to suppliers', accent: C.danger, bg: C.dangerLight, href: '/purchases' },
        ].map(({ label, value, sub, accent, bg, href }) => {
          const content = (
            <>
              <div className="w-1 flex-shrink-0" style={{ background: accent }} />
              <div className="flex-1 px-3 py-2.5 min-w-0">
                <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: accent }}>{label}</div>
                <div className="text-lg font-black tabnum truncate mt-0.5" style={{ color: C.fg }}>{value}</div>
                <div className="text-[10px] font-semibold" style={{ color: accent, opacity: 0.7 }}>{sub}</div>
              </div>
            </>
          )
          return href ? (
            <a key={label} href={href} className="rounded-xl overflow-hidden flex active:scale-95 transition-transform no-underline" style={{ background: bg, boxShadow: C.shadow }}>
              {content}
            </a>
          ) : (
            <div key={label} className="rounded-xl overflow-hidden flex" style={{ background: bg, boxShadow: C.shadow }}>
              {content}
            </div>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
          <input type="text" placeholder="Search products, brand, size, code..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 border-2 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5B2A86]/25"
            style={{ borderColor: C.border, background: C.surface }} />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: C.border }}>
              <X size={10} style={{ color: C.muted }} />
            </button>
          )}
        </div>
        <a href="/purchases/new"
          className="rounded-xl px-4 flex items-center gap-1.5 text-sm font-black active:scale-95 transition-transform no-underline"
          style={{ background: C.primary, color: '#fff' }}>
          <PackagePlus size={15} /> Add Stock
        </a>
      </div>

      {/* Product table */}
      {products.length === 0 ? (
        <div className="text-center py-16" style={{ color: C.muted }}>
          <Package size={40} className="mx-auto mb-3 opacity-20" />
          <div className="text-sm font-bold">No products yet</div>
          <div className="text-xs mt-1 opacity-60">Use "Add Stock" to create products</div>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ boxShadow: C.shadow }}>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: C.surface }}>
              <thead>
                <tr style={{ background: C.headerBg, borderBottom: `2px solid ${C.border}` }}>
                  {[
                    ['Product', 'left', 200],
                    ['Category', 'left', 100],
                    ['Unit', 'center', 72],
                    ['Stock', 'center', 65],
                    ['Cost/Unit', 'right', 95],
                    ['Cost/Pc', 'right', 85],
                    ['Sell', 'right', 90],
                    ['Sell/Pc', 'right', 80],
                    ['Margin', 'right', 65],
                    ['', 'center', 100],
                  ].map(([label, align, w], i) => (
                    <th key={i} style={{
                      textAlign: align as 'left' | 'right' | 'center',
                      width: Number(w), padding: '8px 8px',
                      fontSize: 9, fontWeight: 900, letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: C.muted, whiteSpace: 'nowrap',
                      background: C.headerBg,
                    }}>
                      {label as string}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p, idx) => {
                  const isLow = p.stock_qty <= p.min_stock
                  const multi = isMultiUnit(p)
                  const ppu = p.pieces_per_unit || 1
                  const uLabel = UNIT_LABELS[p.unit_type as UnitType] || p.unit_type
                  const displayCost = multi && ppu > 1 ? p.buy_price * ppu : p.buy_price
                  const sellPc = getEffectiveSellPricePiece(p)
                  const margin = sellPc > 0 && p.buy_price > 0
                    ? Math.round(((sellPc - p.buy_price) / p.buy_price) * 100) : null

                  const isEditingCost = editCost?.id === p.id
                  const isEditingCostPc = editCostPc?.id === p.id
                  const isEditingSell = editSell?.id === p.id
                  const isEditingSellPc = editSellPc?.id === p.id
                  const anyEditing = isEditingCost || isEditingCostPc || isEditingSell || isEditingSellPc
                  const rowBg = anyEditing ? C.primaryLight : idx % 2 === 0 ? C.surface : C.rowAlt

                  return (
                    <tr key={p.id} style={{ background: rowBg, borderBottom: `1px solid ${C.border}`, transition: 'background 0.1s' }}
                      onMouseEnter={e => { if (!anyEditing) (e.currentTarget).style.background = C.bg }}
                      onMouseLeave={e => { if (!anyEditing) (e.currentTarget).style.background = rowBg; if (deleteConfirm === p.id) setDeleteConfirm(null) }}>

                      {/* Product */}
                      <td style={{ padding: '7px 8px' }}>
                        <button onClick={() => openProduct(p)} className="text-left w-full">
                          <div className="font-bold truncate" style={{ color: C.fg, maxWidth: 190, fontSize: 13 }}>
                            {p.brand && <span style={{ color: C.muted, fontWeight: 500 }}>{p.brand} </span>}
                            {p.name}
                          </div>
                          {p.size && <div className="text-[10px] font-semibold" style={{ color: C.muted }}>{p.size}</div>}
                        </button>
                      </td>

                      {/* Category */}
                      <td style={{ padding: '7px 8px', color: C.muted, fontSize: 11, fontWeight: 600 }}>
                        {p.category ?? '---'}
                      </td>

                      {/* Unit */}
                      <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
                          background: multi ? C.primaryLight : '#F0F4FF',
                          color: multi ? C.primary : '#3B5BDB',
                        }}>
                          {multi ? `${p.unit_type}/${ppu}` : 'PC'}
                        </span>
                      </td>

                      {/* Stock */}
                      <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                        <div className="tabnum font-black" style={{ fontSize: 13, color: isLow ? C.danger : C.fg }}>
                          {p.stock_qty}
                        </div>
                        {isLow && (
                          <div className="flex items-center justify-center gap-0.5" style={{ fontSize: 8, color: C.danger, fontWeight: 900 }}>
                            <AlertTriangle size={8} /> LOW
                          </div>
                        )}
                      </td>

                      {/* Cost/Unit — editable */}
                      <td style={{ padding: '6px 8px', textAlign: 'right', cursor: 'text' }}
                        onClick={() => !isEditingCost && setEditCost({ id: p.id, value: String(displayCost) })}>
                        <EditableCell
                          editing={isEditingCost}
                          value={editCost?.value ?? ''}
                          onChange={v => setEditCost({ id: p.id, value: v })}
                          onCommit={() => commitCost(p)}
                          onCancel={() => setEditCost(null)}
                          saving={savingCost}
                          displayValue={fmt(displayCost)}
                          displayColor={C.fg}
                          sub={multi ? `per ${uLabel.toLowerCase()}` : undefined}
                        />
                      </td>

                      {/* Cost/Pc — editable */}
                      <td style={{ padding: '6px 8px', textAlign: 'right', cursor: 'text' }}
                        onClick={() => !isEditingCostPc && setEditCostPc({ id: p.id, value: String(p.buy_price) })}>
                        <EditableCell
                          editing={isEditingCostPc}
                          value={editCostPc?.value ?? ''}
                          onChange={v => setEditCostPc({ id: p.id, value: v })}
                          onCommit={() => commitCostPc(p)}
                          onCancel={() => setEditCostPc(null)}
                          saving={savingCostPc}
                          displayValue={fmt(p.buy_price)}
                          displayColor={C.muted}
                          sub="per pc"
                        />
                      </td>

                      {/* Sell — editable */}
                      <td style={{ padding: '6px 8px', textAlign: 'right', cursor: 'text' }}
                        onClick={() => !isEditingSell && setEditSell({ id: p.id, value: String(p.sell_price > 0 ? p.sell_price : getEffectiveSellPrice(p)) })}>
                        <EditableCell
                          editing={isEditingSell}
                          value={editSell?.value ?? ''}
                          onChange={v => setEditSell({ id: p.id, value: v })}
                          onCommit={() => commitSell(p)}
                          onCancel={() => setEditSell(null)}
                          saving={savingSell}
                          displayValue={p.sell_price > 0 ? fmt(p.sell_price) : fmt(getEffectiveSellPrice(p))}
                          displayColor={p.sell_price > 0 ? C.primary : C.danger}
                          sub={multi ? `per ${uLabel.toLowerCase()}` : undefined}
                        />
                        {p.sell_price <= 0 && (
                          <div style={{ fontSize: 8, color: C.danger, fontWeight: 800 }}>Set price</div>
                        )}
                      </td>

                      {/* Sell/Pc — editable */}
                      <td style={{ padding: '6px 8px', textAlign: 'right', cursor: 'text' }}
                        onClick={() => !isEditingSellPc && setEditSellPc({ id: p.id, value: String(sellPc) })}>
                        <EditableCell
                          editing={isEditingSellPc}
                          value={editSellPc?.value ?? ''}
                          onChange={v => setEditSellPc({ id: p.id, value: v })}
                          onCommit={() => commitSellPc(p)}
                          onCancel={() => setEditSellPc(null)}
                          saving={savingSellPc}
                          displayValue={fmt(sellPc)}
                          displayColor={C.success}
                          sub="per pc"
                        />
                      </td>

                      {/* Margin */}
                      <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                        {margin !== null ? (
                          <span className="tabnum font-black" style={{
                            fontSize: 12,
                            color: margin >= 20 ? C.success : margin >= 0 ? C.warning : C.danger,
                          }}>
                            {margin}%
                          </span>
                        ) : (
                          <span style={{ color: C.border, fontSize: 12 }}>---</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '7px 6px', textAlign: 'center' }}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openProduct(p)}
                            className="text-[10px] font-bold px-2 py-1 rounded-md transition active:scale-95"
                            style={{ background: C.primaryLight, color: C.primary, border: `1px solid ${C.border}` }}>
                            Edit
                          </button>
                          <button onClick={() => handleDelete(p)}
                            disabled={deleting && deleteConfirm === p.id}
                            className="text-[10px] font-bold px-2 py-1 rounded-md transition active:scale-95"
                            style={{
                              background: deleteConfirm === p.id ? C.danger : C.dangerLight,
                              border: `1px solid ${deleteConfirm === p.id ? C.danger : '#FECACA'}`,
                              color: deleteConfirm === p.id ? '#fff' : C.danger,
                            }}>
                            {deleting && deleteConfirm === p.id ? '...' : deleteConfirm === p.id ? 'Sure?' : 'Del'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div style={{ borderTop: `1px solid ${C.border}`, background: C.bg, padding: '10px 16px' }}>
              <button onClick={() => loadProducts(true)} disabled={loadingMore}
                className="w-full py-2.5 rounded-xl text-xs font-black transition active:scale-95 disabled:opacity-50"
                style={{ background: C.primaryLight, color: C.primary }}>
                {loadingMore ? 'Loading...' : 'Load more products'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
