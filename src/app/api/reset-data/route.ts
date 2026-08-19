import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const confirm = searchParams.get('confirm')
  const seedOnly = searchParams.get('seed') !== 'no' // default: seed after wipe
  if (confirm !== 'yes') {
    return NextResponse.json({ error: 'Pass ?confirm=yes to proceed. Add &seed=no to wipe only.' }, { status: 400 })
  }

  const log: string[] = []

  // ── 1. Delete all data in dependency order ──
  // credit_payments → credits → sale_items → sales
  // purchase_order_items → purchase_orders → stock_entries → products → suppliers

  const tables = [
    'credit_payments',
    'credits',
    'sale_items',
    'sales',
    'purchase_order_items',
    'purchase_orders',
    'stock_entries',
    'expenses',
    'products',
    'suppliers',
  ]

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      log.push(`${table}: ERROR - ${error.message}`)
    } else {
      log.push(`${table}: wiped`)
    }
  }

  if (!seedOnly) {
    return NextResponse.json({ status: 'done', log })
  }

  // ── 2. Seed one supplier ──
  const { data: supplier } = await supabase.from('suppliers').insert({
    name: 'TAWAKALL GENERAL STORES LTD',
    address: 'JAM STREET, EASTLEIGH',
    phone: '0728328080, 0728328050',
    kra_pin: 'P051500648Y',
    agent_no: '2916449',
    store_no: '2918678',
  }).select('id').single()

  const supplierId = supplier?.id
  log.push(`supplier: created TAWAKALL (${supplierId})`)

  // ── 3. Seed test products ──
  const testProducts = [
    { name: 'HILWA CONDENSED MILK', code: '000014612', size: '48x390G', unit_type: 'PC', pieces_per_unit: 1, buy_price: 270, sell_price: 300, category: 'Dairy & Spreads', vat_class: 'A' },
    { name: 'VGG COCONUT CREAM', code: '000004117', size: '24x400ML', unit_type: 'CTN', pieces_per_unit: 24, buy_price: 200, sell_price: 4800, category: 'Canned & Sauces', vat_class: 'A' },
    { name: 'MUTLU SPAGHETTI', code: '000014717', size: '20x500G', unit_type: 'CTN', pieces_per_unit: 20, buy_price: 117.5, sell_price: 2350, category: 'Staples & Flour', vat_class: 'A' },
    { name: 'SAAD TIMIR', code: '000004259', size: '10KG', unit_type: 'CTN', pieces_per_unit: 1, buy_price: 3750, sell_price: 4200, category: 'Staples & Flour', vat_class: 'B' },
    { name: 'BROOKSIDE MILK TIN', code: '000008699', size: '12x900G', unit_type: 'CTN', pieces_per_unit: 12, buy_price: 966.67, sell_price: 11600, category: 'Dairy & Spreads', vat_class: 'A' },
    { name: 'BLUE BAND', code: '1000762', size: '12x1KG', unit_type: 'CTN', pieces_per_unit: 12, buy_price: 470.83, sell_price: 5650, category: 'Dairy & Spreads', vat_class: 'A' },
    { name: 'POPCO OIL', code: '000013989', size: '6x2LTR', unit_type: 'CTN', pieces_per_unit: 6, buy_price: 541.67, sell_price: 3250, category: 'Cooking Oils', vat_class: 'A' },
    { name: 'CRYSTAL SHAMPOO', code: '000004492', size: '4x5LTR', unit_type: 'CTN', pieces_per_unit: 4, buy_price: 205, sell_price: 820, category: 'Toiletries & Personal Care', vat_class: 'B' },
    { name: 'TWIST BISCUIT', code: '000004878', size: '6x24PC', unit_type: 'PKT', pieces_per_unit: 6, buy_price: 83.33, sell_price: 500, category: 'Snacks & Confectionery', vat_class: 'A' },
    { name: 'EVEREADY AA', code: '000004880', size: '5xAA', unit_type: 'PKT', pieces_per_unit: 5, buy_price: 550, sell_price: 2750, category: 'Batteries & Electronics', vat_class: 'A' },
  ]

  const insertedProducts: { id: string; name: string; buy_price: number }[] = []

  for (const tp of testProducts) {
    const sellPricePiece = tp.pieces_per_unit > 1 ? Math.round(tp.sell_price / tp.pieces_per_unit) : null
    const { data: prod } = await supabase.from('products').insert({
      ...tp,
      sell_price_piece: sellPricePiece,
      stock_qty: 0,
      min_stock: 5,
      supplier_name: 'TAWAKALL GENERAL STORES LTD',
      supplier_id: supplierId,
      is_active: true,
    }).select('id, name, buy_price').single()
    if (prod) insertedProducts.push(prod)
  }
  log.push(`products: created ${insertedProducts.length} test products`)

  // ── 4. Seed stock via direct inserts (stock_entries trigger updates stock_qty) ──
  const stockEntries = insertedProducts.map((p, i) => {
    const ppu = testProducts[i].pieces_per_unit
    const qty = ppu > 1 ? ppu * 2 : 12 // 2 units or 12 pieces
    return {
      product_id: p.id,
      quantity: qty,
      buy_price: p.buy_price,
      supplier: 'TAWAKALL GENERAL STORES LTD',
      supplier_id: supplierId,
    }
  })

  const { error: stockErr } = await supabase.from('stock_entries').insert(stockEntries)
  if (stockErr) {
    log.push(`stock_entries: ERROR - ${stockErr.message}`)
  } else {
    log.push(`stock_entries: created ${stockEntries.length} entries (stock trigger updates product quantities)`)
  }

  // Also create a purchase order record for reference
  const totalAmount = stockEntries.reduce((s, e, i) => s + e.quantity * e.buy_price, 0)
  const { data: po } = await supabase.from('purchase_orders').insert({
    supplier_name: 'TAWAKALL GENERAL STORES LTD',
    supplier_phone: '0728328080, 0728328050',
    supplier_id: supplierId,
    total_amount: totalAmount,
    paid_amount: totalAmount,
    notes: 'Test seed order',
    receipt_number: 'TEST/0000001',
    receipt_type: 'cash_sale',
  }).select('id').single()
  log.push(`purchase_order: created (${po?.id})`)

  // ── 5. Seed one test sale ──
  const { data: sale } = await supabase.from('sales').insert({
    total: 850,
    paid_amount: 850,
    method: 'cash',
    cash_amount: 850,
    mpesa_amount: 0,
    client_name: 'Sultan Shop',
    client_phone: '0722123456',
  }).select('id').single()

  if (sale && insertedProducts.length >= 2) {
    await supabase.from('sale_items').insert([
      { sale_id: sale.id, product_id: insertedProducts[0].id, quantity: 2, unit_price: 300, buy_price: 270, line_total: 600 },
      { sale_id: sale.id, product_id: insertedProducts[8].id, quantity: 1, unit_price: 250, buy_price: 200, line_total: 250 },
    ])
    log.push(`sale: created test sale (${sale.id})`)
  }

  return NextResponse.json({ status: 'done', log })
}
