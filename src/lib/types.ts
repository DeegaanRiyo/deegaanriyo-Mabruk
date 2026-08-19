// ── Unit Types ──────────────────────────────────────────────
export const UNIT_TYPES = ['PC', 'PKT', 'CTN', 'BAL', 'DOZ', 'BAG', 'OUT', 'DRS', 'BOX', 'EA'] as const
export type UnitType = (typeof UNIT_TYPES)[number]

/** Unit type display labels */
export const UNIT_LABELS: Record<UnitType, string> = {
  PC:  'Piece',
  PKT: 'Packet',
  CTN: 'Carton',
  BAL: 'Bale',
  DOZ: 'Dozen',
  BAG: 'Bag',
  OUT: 'Outer',
  DRS: 'Dozen Strip',
  BOX: 'Box',
  EA:  'Each',
}

/** True when product is sold in multi-piece units (carton, bale, packet, etc.) */
export function isMultiUnit(p: { pieces_per_unit: number }): boolean {
  return (p.pieces_per_unit || 1) > 1
}

/** True when product is sold by weight (KG) — e.g. 10KG rice bag, 2KG sugar packet.
 *  Requires BOTH: size ends in KG AND pieces_per_unit > 1 (ppu = KG per unit).
 *  A sealed 2KG flour packet (ppu=1) is NOT a weight product — it sells as one piece. */
export function isWeightProduct(p: { size: string | null; pieces_per_unit: number }): boolean {
  if (!p.size) return false
  if ((p.pieces_per_unit || 1) <= 1) return false
  const s = p.size.trim().toUpperCase()
  return /^\d*KG$/i.test(s)
}

// ── VAT ─────────────────────────────────────────────────────
export const VAT_RATES: Record<string, number> = { A: 0.16, B: 0 }

/** Get effective sell price — if none set, use cost + 10% minimum markup */
export function getEffectiveSellPrice(p: {
  sell_price: number
  buy_price: number
  pieces_per_unit: number
}): number {
  if (p.sell_price > 0) return p.sell_price
  const ppu = p.pieces_per_unit || 1
  const costPerUnit = p.buy_price * ppu
  return Math.ceil(costPerUnit * 1.1)
}

/** Get effective sell price per piece */
export function getEffectiveSellPricePiece(p: {
  sell_price: number
  sell_price_piece: number | null
  buy_price: number
  pieces_per_unit: number
}): number {
  if (p.sell_price_piece && p.sell_price_piece > 0) return p.sell_price_piece
  if (p.sell_price > 0) {
    const ppu = p.pieces_per_unit || 1
    return ppu > 1 ? Math.round(p.sell_price / ppu) : p.sell_price
  }
  // Fallback: cost + 10%
  return Math.ceil(p.buy_price * 1.1)
}

// ── Interfaces ──────────────────────────────────────────────

export interface Supplier {
  id: string
  name: string
  address: string | null
  phone: string | null
  kra_pin: string | null
  agent_no: string | null
  store_no: string | null
  notes: string | null
  created_at: string
}

export interface Product {
  id: string
  name: string
  code: string | null
  brand: string | null
  category: string | null
  size: string | null
  unit_type: UnitType
  pieces_per_unit: number
  buy_price: number
  sell_price: number
  sell_price_piece: number | null
  stock_qty: number
  min_stock: number
  supplier_name: string | null
  supplier_id: string | null
  vat_class: string
  is_active: boolean
  created_at: string
  updated_at: string
}

/** Predefined categories based on real Eastleigh duka inventory */
export const PRODUCT_CATEGORIES = [
  'Staples & Flour',
  'Canned & Sauces',
  'Dairy & Spreads',
  'Cooking Oils',
  'Snacks & Confectionery',
  'Hot Beverages',
  'Cold Beverages',
  'Porridge & Baking',
  'Cleaning & Household',
  'Toiletries & Personal Care',
  'Paper Products',
  'Fragrance & Air Care',
  'Cooking Aids',
  'Batteries & Electronics',
] as const

export interface StockEntry {
  id: string
  product_id: string
  quantity: number
  buy_price: number
  supplier: string | null
  supplier_id: string | null
  notes: string | null
  created_at: string
  products?: Pick<Product, 'name' | 'unit_type' | 'size'> | null
}

export interface Sale {
  id: string
  total: number
  paid_amount: number
  method: 'cash' | 'mpesa' | 'split' | null
  cash_amount: number
  mpesa_amount: number
  mpesa_ref: string | null
  client_name: string | null
  client_phone: string | null
  notes: string | null
  created_at: string
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  sell_mode: 'unit' | 'piece'
  sell_qty: number | null
  unit_price: number
  buy_price: number
  line_total: number
  created_at: string
  products?: Pick<Product, 'name' | 'unit_type' | 'size' | 'code' | 'pieces_per_unit'> | null
}

export interface Credit {
  id: string
  sale_id: string | null
  client_name: string
  client_phone: string | null
  amount: number
  paid: number
  is_settled: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreditPayment {
  id: string
  credit_id: string
  amount: number
  method: 'cash' | 'mpesa' | null
  notes: string | null
  created_at: string
}

export interface Expense {
  id: string
  description: string
  amount: number
  category: string | null
  created_at: string
}

export interface PurchaseOrder {
  id: string
  supplier_name: string
  supplier_phone: string | null
  supplier_id: string | null
  total_amount: number
  paid_amount: number
  receipt_number: string | null
  receipt_type: string | null
  receipt_date: string | null
  discount: number
  vat_total: number
  served_by: string | null
  customer_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  product_id: string | null
  product_name: string
  quantity: number
  buy_price: number
  line_total: number
  supplier_code: string | null
  vat_class: string | null
  unit_type: string | null
  created_at: string
}
