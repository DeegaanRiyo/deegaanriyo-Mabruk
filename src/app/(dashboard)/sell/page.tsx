'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Product, isMultiUnit, isWeightProduct, UNIT_LABELS, UnitType, getEffectiveSellPrice, getEffectiveSellPricePiece } from '@/lib/types'
import { fmt } from '@/lib/utils'
import { Search, Plus, Minus, Trash2, ShoppingCart, X, ChevronDown, User, Phone, CreditCard, Banknote, ArrowRight } from 'lucide-react'

// ── Design tokens ───────────────────────────────────────────────────────────
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
  accent: '#C9912B',
  rowAlt: '#FAFAFB',
  rowActive: '#F3ECFA',
  headerBg: '#F7F4FA',
} as const

interface CartItem {
  product: Product
  quantity: number
  mode: 'unit' | 'piece'
}

type PayMethod = 'cash' | 'mpesa' | 'split'

const fmtQty = (q: number) => q === 0.5 ? '½' : q % 1 === 0.5 ? `${Math.floor(q)}½` : String(q)

function CartLine({ c, unitPrice, onQty, onRemove }: {
  c: CartItem
  unitPrice: number
  onQty: (pid: string, mode: 'unit' | 'piece', d: number) => void
  onRemove: (pid: string, mode: 'unit' | 'piece') => void
}) {
  const isWt = isWeightProduct(c.product)
  const uLbl = (UNIT_LABELS[c.product.unit_type as UnitType] || c.product.unit_type).toLowerCase()
  return (
    <div className="flex items-center gap-2 py-2.5 px-3"
      style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="flex-1 min-w-0">
        <div className="truncate text-[13px] font-bold" style={{ color: C.fg }}>
          {c.product.name}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {c.mode === 'unit' ? (
            <span className="text-[10px] font-bold px-1.5 rounded"
              style={{ background: C.primaryLight, color: C.primary }}>
              {isWt
                ? `${fmtQty(c.quantity)} ${uLbl} (${(c.product.pieces_per_unit || 1) * c.quantity}KG)`
                : `${fmtQty(c.quantity)} ${uLbl}`}
            </span>
          ) : isWt ? (
            <span className="text-[10px] font-bold px-1.5 rounded"
              style={{ background: C.successLight, color: C.success }}>
              {fmtQty(c.quantity)} KG
            </span>
          ) : (
            <>
              {c.product.size && (
                <span className="text-[10px] font-semibold" style={{ color: C.muted }}>{c.product.size}</span>
              )}
              <span className="text-[10px] font-bold px-1.5 rounded"
                style={{ background: C.successLight, color: C.success }}>
                {c.quantity} pc
              </span>
            </>
          )}
          <span className="text-[10px] tabnum font-semibold" style={{ color: C.muted }}>
            @ {fmt(unitPrice)}{c.mode === 'piece' && (isWt ? '/kg' : '/pc') || `/${uLbl}`}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => onQty(c.product.id, c.mode, -1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-transform"
          style={{ background: C.primaryLight, color: C.primary }}>
          <Minus size={13} strokeWidth={2.5} />
        </button>
        <span className="w-8 text-center text-sm font-black tabnum" style={{ color: C.fg }}>
          {fmtQty(c.quantity)}
        </span>
        <button onClick={() => onQty(c.product.id, c.mode, 1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-transform"
          style={{ background: C.primaryLight, color: C.primary }}>
          <Plus size={13} strokeWidth={2.5} />
        </button>
      </div>
      <button onClick={() => onRemove(c.product.id, c.mode)}
        className="w-7 h-7 flex items-center justify-center flex-shrink-0 rounded-lg active:scale-90 transition-transform"
        style={{ color: C.danger, background: C.dangerLight }}>
        <Trash2 size={12} />
      </button>
      <div className="w-[72px] text-right text-[13px] font-black tabnum flex-shrink-0" style={{ color: C.fg }}>
        {fmt(unitPrice * c.quantity)}
      </div>
    </div>
  )
}

export default function SellPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchRef = useRef<HTMLInputElement>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = sessionStorage.getItem('mabruk_cart')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null)
  const [mobileCart, setMobileCart] = useState(false)

  // Checkout state
  const [method, setMethod] = useState<PayMethod>('cash')
  const [mpesaRef, setMpesaRef] = useState('')
  const [cashAmount, setCashAmount] = useState('')
  const [mpesaAmount, setMpesaAmount] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [showPay, setShowPay] = useState(false)

  // Persist cart
  useEffect(() => {
    try { sessionStorage.setItem('mabruk_cart', JSON.stringify(cart)) } catch {}
  }, [cart])

  const [searching, setSearching] = useState(false)
  const productsRef = useRef<Product[]>([])
  productsRef.current = products

  const load = useCallback(async (append = false, term = '') => {
    if (append) {
      setLoadingMore(true)
    } else if (productsRef.current.length === 0) {
      setLoading(true)
    } else {
      setSearching(true)
    }
    const start = append ? productsRef.current.length : 0
    let q = supabase.from('products').select('*')
      .eq('is_active', true).gt('stock_qty', 0).order('name')
      .range(start, start + 59)
    if (term.trim()) {
      const s = `%${term.trim()}%`
      q = q.or(`name.ilike.${s},brand.ilike.${s},size.ilike.${s},code.ilike.${s}`)
    }
    const { data } = await q
    const rows = (data ?? []) as Product[]
    if (append) setProducts(prev => [...prev, ...rows]); else setProducts(rows)
    setHasMore(rows.length === 60)
    setLoading(false)
    setLoadingMore(false)
    setSearching(false)
  }, []) // eslint-disable-line

  useEffect(() => {
    if (search === '') {
      load(false, '')
      return
    }
    const t = setTimeout(() => load(false, search), 300)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line

  // Keyboard: "/" focuses search
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault(); searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  // ── Cart operations ───────────────────────────────────────────────────────
  function add(product: Product) {
    if (isMultiUnit(product) || isWeightProduct(product)) { setPendingProduct(product); return }
    addMode(product, 'piece')
  }

  function addMode(product: Product, mode: 'unit' | 'piece', qty = 1) {
    const ppu = product.pieces_per_unit || 1
    setCart(prev => {
      const ex = prev.find(c => c.product.id === product.id && c.mode === mode)
      if (ex) {
        const max = mode === 'unit' ? product.stock_qty / ppu : product.stock_qty
        const next = ex.quantity + qty
        if (next > max) return prev
        return prev.map(c => c.product.id === product.id && c.mode === mode ? { ...c, quantity: next } : c)
      }
      return [...prev, { product, quantity: qty, mode }]
    })
    setPendingProduct(null)
  }

  function updQty(pid: string, mode: 'unit' | 'piece', d: number) {
    setCart(prev => prev.map(c => {
      if (c.product.id !== pid || c.mode !== mode) return c
      const isWt = isWeightProduct(c.product)
      const step = (isWt && mode === 'piece') ? 0.5
        : (mode === 'unit' && isMultiUnit(c.product) && !isWt) ? 0.5
        : 1
      const n = c.quantity + d * step
      if (n <= 0) return null
      const ppu = c.product.pieces_per_unit || 1
      const max = mode === 'unit' ? c.product.stock_qty / ppu : c.product.stock_qty
      return n > max ? c : { ...c, quantity: n }
    }).filter(Boolean) as CartItem[])
  }

  function rem(pid: string, mode: 'unit' | 'piece') {
    setCart(prev => prev.filter(c => !(c.product.id === pid && c.mode === mode)))
  }

  function price(c: CartItem) {
    return c.mode === 'unit' ? getEffectiveSellPrice(c.product) : getEffectiveSellPricePiece(c.product)
  }

  function inCart(pid: string) { return cart.filter(c => c.product.id === pid).reduce((s, c) => s + c.quantity, 0) }

  const total = cart.reduce((s, c) => s + price(c) * c.quantity, 0)
  const count = cart.reduce((s, c) => s + c.quantity, 0)

  // Compute paid
  const cashVal = parseFloat(cashAmount) || 0
  const mpesaVal = parseFloat(mpesaAmount) || 0
  let paid: number
  if (method === 'cash') paid = cashVal || total
  else if (method === 'mpesa') paid = mpesaVal || total
  else paid = cashVal + mpesaVal

  const isCredit = paid < total
  const change = paid > total ? paid - total : 0

  async function checkout() {
    if (!cart.length || processing) return
    setProcessing(true)

    const finalCash = method === 'cash' ? (cashVal || total) : method === 'split' ? cashVal : 0
    const finalMpesa = method === 'mpesa' ? (mpesaVal || total) : method === 'split' ? mpesaVal : 0
    const finalPaid = finalCash + finalMpesa

    const { data: sale, error: err } = await supabase.from('sales').insert({
      total,
      paid_amount: finalPaid,
      method,
      cash_amount: finalCash,
      mpesa_amount: finalMpesa,
      mpesa_ref: (method === 'mpesa' || method === 'split') ? mpesaRef.trim() || null : null,
      client_name: clientName.trim() || null,
      client_phone: clientPhone.trim() || null,
    }).select('id').single()
    if (err || !sale) { setProcessing(false); return }

    await supabase.from('sale_items').insert(cart.map(c => {
      const ppu = c.product.pieces_per_unit || 1
      const qtyPieces = c.mode === 'unit' ? c.quantity * ppu : c.quantity
      const pricePerPiece = c.mode === 'unit'
        ? getEffectiveSellPricePiece(c.product)
        : price(c)
      return {
        sale_id: sale.id, product_id: c.product.id,
        quantity: qtyPieces,
        sell_mode: c.mode,
        sell_qty: c.quantity,
        unit_price: pricePerPiece,
        buy_price: c.product.buy_price,
        line_total: price(c) * c.quantity,
      }
    }))

    if (isCredit && clientName.trim()) {
      await supabase.from('credits').insert({
        sale_id: sale.id, client_name: clientName.trim(),
        client_phone: clientPhone.trim() || null, amount: total, paid: finalPaid,
      })
    }
    try { sessionStorage.removeItem('mabruk_cart') } catch {}
    router.push(`/sales/${sale.id}/receipt`)
  }

  function openCheckout() {
    setShowPay(true)
    if (method === 'cash') setCashAmount(String(total))
    else if (method === 'mpesa') setMpesaAmount(String(total))
  }

  function switchMethod(m: PayMethod) {
    setMethod(m)
    if (m === 'cash') { setCashAmount(String(total)); setMpesaAmount('') }
    if (m === 'mpesa') { setMpesaAmount(String(total)); setCashAmount('') }
    if (m === 'split') { setCashAmount(''); setMpesaAmount('') }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) return (
    <div className="p-3">
      <div className="animate-pulse space-y-2">
        <div className="h-10 rounded-xl" style={{ background: C.border }} />
        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-12 rounded-lg" style={{ background: C.border, opacity: 0.5 }} />)}
      </div>
    </div>
  )

  // ── Cart line item (extracted to module scope) ─────────────────────────────

  // ── Cart content ──────────────────────────────────────────────────────────
  const cartContent = (
    <>
      {cart.length === 0 ? (
        <div className="text-center py-10" style={{ color: C.muted }}>
          <ShoppingCart size={28} className="mx-auto mb-3 opacity-20" />
          <div className="text-sm font-bold">Cart is empty</div>
          <div className="text-[11px] mt-1 opacity-60">Tap a product to add it</div>
        </div>
      ) : (
        <div>{cart.map(c => <CartLine key={`${c.product.id}-${c.mode}`} c={c} unitPrice={price(c)} onQty={updQty} onRemove={rem} />)}</div>
      )}
    </>
  )

  // ── Checkout footer ───────────────────────────────────────────────────────
  const checkoutFooter = cart.length > 0 && (
    <div className="p-3 space-y-3" style={{ borderTop: `2px solid ${C.border}`, background: C.headerBg }}>

      {/* Total bar */}
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Total</span>
        <span className="font-black tabnum" style={{ fontSize: 20, color: C.fg }}>
          KES {fmt(total)}
        </span>
      </div>

      {!showPay ? (
        <button onClick={openCheckout}
          className="w-full rounded-xl py-3 text-sm font-black active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          style={{ background: C.primary, color: '#fff' }}>
          <ShoppingCart size={15} />
          Checkout {count} item{count !== 1 ? 's' : ''}
          <ArrowRight size={15} />
        </button>
      ) : (
        <div className="space-y-3">

          {/* ── Customer info ── */}
          <div className="rounded-xl p-3" style={{ background: C.surface, border: `1.5px solid ${C.border}` }}>
            <div className="text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-1.5"
              style={{ color: C.muted }}>
              <User size={10} /> Customer
            </div>
            <div className="space-y-2">
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
                <input placeholder="Customer name" value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5B2A86]/30"
                  style={{ borderColor: C.border, background: C.bg }} />
              </div>
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
                <input placeholder="Phone (for WhatsApp receipt)" value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5B2A86]/30"
                  style={{ borderColor: C.border, background: C.bg }} />
              </div>
              {clientPhone.trim() && (
                <div className="text-[10px] font-semibold px-1 flex items-center gap-1" style={{ color: C.success }}>
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Receipt will be sent to this number
                </div>
              )}
            </div>
          </div>

          {/* ── Payment method ── */}
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: C.muted }}>
              Payment
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                ['cash', 'Cash', Banknote, C.primary],
                ['mpesa', 'M-Pesa', CreditCard, C.success],
                ['split', 'Split', CreditCard, C.accent],
              ] as [PayMethod, string, typeof Banknote, string][]).map(([m, label, Icon, clr]) => (
                <button key={m} onClick={() => switchMethod(m)}
                  className="py-2.5 rounded-xl text-xs font-black border-2 transition-all flex flex-col items-center gap-1"
                  style={method === m
                    ? { background: clr, color: '#fff', borderColor: clr }
                    : { background: C.surface, borderColor: C.border, color: C.muted }}>
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Amount inputs ── */}
          {method === 'cash' && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider block mb-1" style={{ color: C.muted }}>
                Cash Received
              </label>
              <input type="number" min="0" step="1" value={cashAmount}
                onChange={e => setCashAmount(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border-2 text-base tabnum font-black focus:outline-none focus:ring-2 focus:ring-[#5B2A86]/30"
                style={{ borderColor: C.primary, background: C.surface }} />
            </div>
          )}

          {method === 'mpesa' && (
            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider block mb-1" style={{ color: C.muted }}>
                  M-Pesa Amount
                </label>
                <input type="number" min="0" step="1" value={mpesaAmount}
                  onChange={e => setMpesaAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border-2 text-base tabnum font-black focus:outline-none focus:ring-2 focus:ring-[#2E7D5B]/30"
                  style={{ borderColor: C.success, background: C.surface }} />
              </div>
              <input placeholder="M-Pesa transaction code (optional)" value={mpesaRef}
                onChange={e => setMpesaRef(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2E7D5B]/20"
                style={{ borderColor: C.border, background: C.bg }} />
            </div>
          )}

          {method === 'split' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider block mb-1" style={{ color: C.muted }}>Cash</label>
                  <input type="number" min="0" step="1" value={cashAmount}
                    onChange={e => setCashAmount(e.target.value)} placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border-2 text-sm tabnum font-black focus:outline-none focus:ring-2 focus:ring-[#5B2A86]/30"
                    style={{ borderColor: C.primary, background: C.surface }} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider block mb-1" style={{ color: C.muted }}>M-Pesa</label>
                  <input type="number" min="0" step="1" value={mpesaAmount}
                    onChange={e => setMpesaAmount(e.target.value)} placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border-2 text-sm tabnum font-black focus:outline-none focus:ring-2 focus:ring-[#2E7D5B]/30"
                    style={{ borderColor: C.success, background: C.surface }} />
                </div>
              </div>
              <input placeholder="M-Pesa transaction code (optional)" value={mpesaRef}
                onChange={e => setMpesaRef(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#C9912B]/20"
                style={{ borderColor: C.border, background: C.bg }} />
              {/* Split total indicator */}
              <div className="flex justify-between text-[11px] font-bold px-1 tabnum" style={{ color: C.muted }}>
                <span>Cash {fmt(cashVal)} + M-Pesa {fmt(mpesaVal)}</span>
                <span style={{ color: (cashVal + mpesaVal) >= total ? C.success : C.danger }}>
                  = {fmt(cashVal + mpesaVal)}
                </span>
              </div>
            </div>
          )}

          {/* Change badge */}
          {paid >= total && change > 0 && (
            <div className="rounded-xl px-4 py-2.5 text-sm font-black text-center"
              style={{ background: C.successLight, color: C.success }}>
              Change: KES {fmt(change)}
            </div>
          )}

          {/* Credit warning */}
          {isCredit && (
            <div className="rounded-xl px-4 py-2.5 text-sm font-bold"
              style={{ background: C.warningLight, color: C.warning }}>
              Credit: KES {fmt(total - paid)} owed
              {!clientName.trim() && (
                <span className="block text-[11px] mt-1 font-semibold" style={{ color: C.danger }}>
                  Customer name required for credit sales
                </span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-[auto,1fr] gap-2">
            <button onClick={() => setShowPay(false)}
              className="px-5 py-3 rounded-xl text-xs font-black border-2 active:scale-[0.98] transition-transform"
              style={{ borderColor: C.border, color: C.muted, background: C.surface }}>
              Back
            </button>
            <button onClick={checkout}
              disabled={processing || (isCredit && !clientName.trim())}
              className="py-3 rounded-xl text-sm font-black active:scale-[0.98] disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              style={{ background: C.success, color: '#fff' }}>
              {processing ? 'Saving...' : isCredit ? `Record Credit Sale` : `Complete Sale`}
              {!processing && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      )}
    </div>
  )

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex" style={{ height: 'calc(100vh - 56px - 72px)' }}>

        {/* ── Product grid ── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Search bar */}
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
              <input ref={searchRef} type="text"
                placeholder='Search products... (press "/" to focus)'
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border-2 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5B2A86]/25 transition-shadow"
                style={{ borderColor: C.border, background: C.surface }} />
              {searching && (
                <div className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: `${C.primary} transparent ${C.primary} ${C.primary}` }} />
              )}
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: C.border }}>
                  <X size={10} style={{ color: C.muted }} />
                </button>
              )}
            </div>
          </div>

          {/* Product table */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <div className="rounded-xl overflow-hidden" style={{ background: C.surface, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.headerBg, borderBottom: `2px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 2 }}>
                    <th className="text-left px-3 py-2" style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, background: C.headerBg }}>
                      Product
                    </th>
                    <th className="text-center py-2" style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, width: 55, background: C.headerBg }}>
                      Stock
                    </th>
                    <th className="text-right px-3 py-2" style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, width: 80, background: C.headerBg }}>
                      Price
                    </th>
                    <th style={{ width: 44, background: C.headerBg }} />
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => {
                    const multi = isMultiUnit(p)
                    const ppu = p.pieces_per_unit || 1
                    const uLbl = UNIT_LABELS[p.unit_type as UnitType]?.toLowerCase() || p.unit_type
                    const low = p.stock_qty <= p.min_stock
                    const cq = inCart(p.id)
                    const sp = getEffectiveSellPrice(p)
                    const bg = cq > 0 ? C.rowActive : i % 2 === 0 ? C.surface : C.rowAlt

                    return (
                      <tr key={p.id}
                        className="cursor-pointer transition-colors"
                        style={{ background: bg, borderBottom: `1px solid ${C.border}` }}
                        onClick={() => add(p)}>

                        {/* Product name */}
                        <td className="px-3 py-2">
                          <div className="font-bold truncate" style={{ fontSize: 13, maxWidth: 220, color: C.fg }}>
                            {p.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {p.code && (
                              <span className="tabnum" style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: C.primary, fontWeight: 700 }}>
                                {p.code}
                              </span>
                            )}
                            {p.size && <span style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>{p.size}</span>}
                            {multi && (
                              <span className="font-black px-1.5 rounded"
                                style={{ fontSize: 8, background: C.primaryLight, color: C.primary }}>
                                {isWeightProduct(p) ? `${ppu}KG/${uLbl}` : `${ppu}pc/${uLbl}`}
                              </span>
                            )}
                            {cq > 0 && (
                              <span className="tabnum font-black px-1.5 rounded"
                                style={{ fontSize: 8, background: C.primary, color: '#fff' }}>
                                {cq} in cart
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Stock */}
                        <td className="py-2 text-center">
                          <div className="tabnum font-black" style={{ fontSize: 12, color: low ? C.danger : C.fg }}>
                            {multi ? Math.floor(p.stock_qty / ppu) : p.stock_qty}
                          </div>
                          {multi && (
                            <div className="tabnum" style={{ fontSize: 8, color: C.muted, fontWeight: 600 }}>
                              {p.stock_qty}{isWeightProduct(p) ? 'kg' : 'pc'}
                            </div>
                          )}
                          {low && <div style={{ fontSize: 7, color: C.danger, fontWeight: 900, letterSpacing: '0.1em' }}>LOW</div>}
                        </td>

                        {/* Price */}
                        <td className="px-3 py-2 text-right">
                          <div className="tabnum font-black" style={{ fontSize: 13, color: C.primary }}>
                            {fmt(sp)}
                          </div>
                          {multi && (
                            <div className="tabnum" style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>
                              {fmt(getEffectiveSellPricePiece(p))}/{isWeightProduct(p) ? 'kg' : 'pc'}
                            </div>
                          )}
                        </td>

                        {/* Add button */}
                        <td className="py-2 pr-2 text-center" onClick={e => e.stopPropagation()}>
                          <button onClick={() => add(p)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all"
                            style={{
                              background: cq > 0 ? C.primary : C.primaryLight,
                              color: cq > 0 ? '#fff' : C.primary,
                              boxShadow: cq > 0 ? '0 2px 6px rgba(91,42,134,0.3)' : 'none',
                            }}>
                            <Plus size={15} strokeWidth={2.5} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <button onClick={() => load(true, search)} disabled={loadingMore}
                className="w-full py-2.5 mt-2 rounded-xl text-xs font-black disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all"
                style={{ background: C.primaryLight, color: C.primary }}>
                <ChevronDown size={13} /> {loadingMore ? 'Loading...' : 'Load more products'}
              </button>
            )}

            {products.length === 0 && (
              <div className="text-center py-16" style={{ color: C.muted }}>
                <Search size={32} className="mx-auto mb-3 opacity-20" />
                <div className="text-sm font-bold">No products found</div>
                <div className="text-xs mt-1 opacity-60">Try a different search term</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Desktop cart sidebar ── */}
        <div className="hidden md:flex flex-col w-[340px] flex-shrink-0" style={{ borderLeft: `2px solid ${C.border}`, background: C.surface }}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: `2px solid ${C.border}`, background: C.headerBg }}>
            <ShoppingCart size={15} style={{ color: C.primary }} />
            <span className="font-black text-sm" style={{ color: C.fg }}>Sale</span>
            {count > 0 && (
              <span className="tabnum text-[11px] font-black px-2 py-0.5 rounded-full"
                style={{ background: C.primary, color: '#fff' }}>
                {count}
              </span>
            )}
            {count > 0 && (
              <span className="ml-auto tabnum text-sm font-black" style={{ color: C.primary }}>
                KES {fmt(total)}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {cartContent}
          </div>
          {checkoutFooter}
        </div>
      </div>

      {/* ── Mobile: sticky checkout bar ── */}
      {cart.length > 0 && !mobileCart && (
        <button onClick={() => setMobileCart(true)}
          className="md:hidden fixed z-40 left-3 right-3 flex items-center justify-between px-5 py-3.5 rounded-2xl active:scale-[0.98] transition-transform"
          style={{ bottom: 80, background: C.primary, color: '#fff', boxShadow: '0 4px 24px rgba(91,42,134,0.45)' }}>
          <div className="flex items-center gap-2.5">
            <ShoppingCart size={17} />
            <span className="font-black text-sm">{count} item{count !== 1 ? 's' : ''}</span>
          </div>
          <span className="font-black text-base tabnum">KES {fmt(total)}</span>
        </button>
      )}

      {/* ── Mobile: cart sheet ── */}
      {mobileCart && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col" onClick={() => setMobileCart(false)}>
          <div className="flex-1" style={{ background: 'rgba(30,22,38,0.4)' }} />
          <div className="rounded-t-2xl max-h-[85vh] flex flex-col" style={{ background: C.surface }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `2px solid ${C.border}` }}>
              <div className="flex items-center gap-2">
                <ShoppingCart size={15} style={{ color: C.primary }} />
                <span className="font-black text-sm">Sale</span>
                <span className="tabnum text-[11px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: C.primary, color: '#fff' }}>{count}</span>
              </div>
              <button onClick={() => setMobileCart(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ background: C.primaryLight }}>
                <X size={14} style={{ color: C.muted }} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {cartContent}
            </div>
            {checkoutFooter}
          </div>
        </div>
      )}

      {/* ── Unit/Piece picker modal ── */}
      {pendingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(30,22,38,0.5)' }}
          onClick={() => setPendingProduct(null)}>
          <div className="w-full max-w-xs rounded-2xl p-5 space-y-4"
            style={{ background: C.surface, boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>

            {/* Product header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="font-black text-[15px]" style={{ color: C.fg }}>{pendingProduct.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  {pendingProduct.size && (
                    <span className="text-[11px] font-semibold" style={{ color: C.muted }}>{pendingProduct.size}</span>
                  )}
                  {isMultiUnit(pendingProduct) && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded"
                      style={{ background: C.primaryLight, color: C.primary }}>
                      {isWeightProduct(pendingProduct)
                        ? `${pendingProduct.pieces_per_unit}KG/${(UNIT_LABELS[pendingProduct.unit_type as UnitType] || pendingProduct.unit_type).toLowerCase()}`
                        : `${pendingProduct.pieces_per_unit}pc/${(UNIT_LABELS[pendingProduct.unit_type as UnitType] || pendingProduct.unit_type).toLowerCase()}`}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setPendingProduct(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0"
                style={{ background: C.primaryLight }}>
                <X size={14} style={{ color: C.muted }} />
              </button>
            </div>

            {(() => {
              const isWt = isWeightProduct(pendingProduct)
              const multi = isMultiUnit(pendingProduct)
              const uLbl = (UNIT_LABELS[pendingProduct.unit_type as UnitType] || pendingProduct.unit_type).toLowerCase()
              const ppu = pendingProduct.pieces_per_unit || 1
              const unitsLeft = Math.floor(pendingProduct.stock_qty / ppu)
              const kgLeft = pendingProduct.stock_qty // stock is in KG for weight products

              if (isWt) {
                // Weight product — show KG presets + full unit option
                return (
                  <div className="space-y-3">
                    {/* KG presets */}
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: C.muted }}>
                        Sell by KG — {fmt(getEffectiveSellPricePiece(pendingProduct))}/KG
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[0.5, 1, 2, 5].map(kg => (
                          <button key={kg} onClick={() => addMode(pendingProduct, 'piece', kg)}
                            disabled={kg > kgLeft}
                            className="py-3 rounded-xl font-black active:scale-95 transition-all disabled:opacity-30"
                            style={{ background: C.surface, color: C.primary, border: `2px solid ${C.primary}` }}>
                            <div style={{ fontSize: 16 }}>{kg}</div>
                            <div style={{ fontSize: 9, color: C.muted }}>KG</div>
                          </button>
                        ))}
                      </div>
                      <div className="text-[10px] font-semibold mt-1.5 text-center" style={{ color: C.muted }}>
                        {kgLeft} KG in stock
                      </div>
                    </div>

                    {/* Full unit option (only for multi-unit like 25KG bags) */}
                    {multi && unitsLeft > 0 && (
                      <button onClick={() => addMode(pendingProduct, 'unit')}
                        className="w-full py-3 rounded-xl font-black active:scale-95 transition-all"
                        style={{ background: C.primary, color: '#fff', boxShadow: '0 4px 12px rgba(91,42,134,0.3)' }}>
                        <div style={{ fontSize: 13 }}>Full {uLbl} ({ppu}KG) — {fmt(getEffectiveSellPrice(pendingProduct))}</div>
                        <div className="mt-0.5 opacity-60" style={{ fontSize: 10 }}>
                          {unitsLeft} {uLbl}{unitsLeft !== 1 ? 's' : ''} left
                        </div>
                      </button>
                    )}
                  </div>
                )
              }

              // Non-weight multi-unit — full / half / piece picker
              const halfPrice = Math.round(getEffectiveSellPrice(pendingProduct) / 2)
              const canHalf = pendingProduct.stock_qty >= ppu * 0.5
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => addMode(pendingProduct, 'unit')}
                      disabled={unitsLeft < 1}
                      className="py-4 rounded-xl font-black active:scale-95 transition-all disabled:opacity-30"
                      style={{ background: C.primary, color: '#fff', boxShadow: '0 4px 12px rgba(91,42,134,0.3)' }}>
                      <div style={{ fontSize: 13 }}>Full {uLbl}</div>
                      <div className="tabnum mt-1.5 font-black" style={{ fontSize: 15 }}>
                        {fmt(getEffectiveSellPrice(pendingProduct))}
                      </div>
                      <div className="mt-1 opacity-60" style={{ fontSize: 10 }}>
                        {ppu} pcs · {unitsLeft} left
                      </div>
                    </button>
                    <button onClick={() => addMode(pendingProduct, 'unit', 0.5)}
                      disabled={!canHalf}
                      className="py-4 rounded-xl font-black active:scale-95 transition-all disabled:opacity-30"
                      style={{ background: C.surface, color: C.primary, border: `2px solid ${C.primary}` }}>
                      <div style={{ fontSize: 13 }}>Half {uLbl}</div>
                      <div className="tabnum mt-1.5 font-black" style={{ fontSize: 15 }}>
                        {fmt(halfPrice)}
                      </div>
                      <div className="mt-1" style={{ fontSize: 10, color: C.muted }}>
                        {Math.round(ppu / 2)} pcs
                      </div>
                    </button>
                  </div>
                  <button onClick={() => addMode(pendingProduct, 'piece')}
                    className="w-full py-3 rounded-xl font-black active:scale-95 transition-all"
                    style={{ background: C.successLight, color: C.success, border: `2px solid ${C.success}` }}>
                    <div style={{ fontSize: 13 }}>By piece — {fmt(getEffectiveSellPricePiece(pendingProduct))}/pc</div>
                    <div className="mt-0.5" style={{ fontSize: 10, color: C.muted }}>
                      {pendingProduct.stock_qty} pcs in stock
                    </div>
                  </button>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Desktop: full height minus TopBar only */}
      <style>{`
        @media (min-width: 768px) {
          .flex[style*="calc(100vh"] { height: calc(100vh - 56px) !important; }
        }
      `}</style>
    </>
  )
}
