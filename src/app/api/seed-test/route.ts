import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST() {
  try {
    // ── 0. Wipe existing data (order matters for FK constraints) ─
    await supabase.from('credit_payments').delete().neq('id', '')
    await supabase.from('credits').delete().neq('id', '')
    await supabase.from('sale_items').delete().neq('id', '')
    await supabase.from('sales').delete().neq('id', '')
    await supabase.from('stock_entries').delete().neq('id', '')
    await supabase.from('purchase_order_items').delete().neq('id', '')
    await supabase.from('purchase_orders').delete().neq('id', '')
    await supabase.from('products').delete().neq('id', '')
    await supabase.from('suppliers').delete().neq('id', '')
    await supabase.from('expenses').delete().neq('id', '')

    // ── 1. Create 2 suppliers ──────────────────────────────────
    const { data: suppliers, error: supErr } = await supabase
      .from('suppliers')
      .insert([
        {
          name: 'TAWAKALL GENERAL STORES LTD',
          address: 'Jam Street, Eastleigh',
          phone: '0728328080',
          kra_pin: 'P051500648Y',
        },
        {
          name: 'KULMIS SPICES',
          address: '12th Street KBS Garage',
          phone: '0722 996 531',
        },
      ])
      .select()

    if (supErr) throw supErr
    const tawakall = suppliers![0]
    const kulmis = suppliers![1]

    // ── 2. Create products ─────────────────────────────────────
    const productRows = [
      // Tawakall products
      { name: 'Pembe Maize Flour',    code: 'T001', brand: 'Pembe',     category: 'Staples & Flour',    size: '2KG',    unit_type: 'PC',  pieces_per_unit: 1, buy_price: 120,  sell_price: 145,  sell_price_piece: null, stock_qty: 0, min_stock: 5,  supplier_name: tawakall.name, supplier_id: tawakall.id, vat_class: 'B' },
      { name: 'Golden Fry Oil',       code: 'T002', brand: 'Golden Fry', category: 'Cooking Oils',      size: '1L',     unit_type: 'PC',  pieces_per_unit: 1, buy_price: 310,  sell_price: 350,  sell_price_piece: null, stock_qty: 0, min_stock: 3,  supplier_name: tawakall.name, supplier_id: tawakall.id, vat_class: 'A' },
      { name: 'KEN FRESH Tea',        code: 'T003', brand: 'Ken Fresh', category: 'Hot Beverages',      size: '500G',   unit_type: 'PC',  pieces_per_unit: 1, buy_price: 220,  sell_price: 260,  sell_price_piece: null, stock_qty: 0, min_stock: 4,  supplier_name: tawakall.name, supplier_id: tawakall.id, vat_class: 'A' },
      { name: 'Colgate Toothpaste',   code: 'T004', brand: 'Colgate',   category: 'Toiletries & Personal Care', size: '100ML', unit_type: 'PC', pieces_per_unit: 1, buy_price: 180, sell_price: 220, sell_price_piece: null, stock_qty: 0, min_stock: 6, supplier_name: tawakall.name, supplier_id: tawakall.id, vat_class: 'A' },
      { name: 'Softcare Tissue',      code: 'T005', brand: 'Softcare',  category: 'Paper Products',     size: '10PK',   unit_type: 'PKT', pieces_per_unit: 10, buy_price: 350, sell_price: 420, sell_price_piece: 45,  stock_qty: 0, min_stock: 3, supplier_name: tawakall.name, supplier_id: tawakall.id, vat_class: 'A' },
      // Tawakall — weight products (sold by KG)
      { name: 'Pishori Rice',         code: 'T006', brand: 'Daawat',    category: 'Staples & Flour',     size: '10KG',  unit_type: 'BAG', pieces_per_unit: 10, buy_price: 140,  sell_price: 1700, sell_price_piece: 180, stock_qty: 0, min_stock: 2, supplier_name: tawakall.name, supplier_id: tawakall.id, vat_class: 'B' },
      { name: 'White Sugar',          code: 'T007', brand: 'Mumias',    category: 'Staples & Flour',     size: '2KG',   unit_type: 'PKT', pieces_per_unit: 2,  buy_price: 135,  sell_price: 300,  sell_price_piece: 155, stock_qty: 0, min_stock: 5, supplier_name: tawakall.name, supplier_id: tawakall.id, vat_class: 'B' },
      { name: 'Omo Washing Powder',   code: 'T008', brand: 'Omo',       category: 'Cleaning & Household', size: '1KG',  unit_type: 'PC',  pieces_per_unit: 1,  buy_price: 280,  sell_price: 340,  sell_price_piece: null, stock_qty: 0, min_stock: 4, supplier_name: tawakall.name, supplier_id: tawakall.id, vat_class: 'A' },
      // Kulmis products
      { name: 'Cardamom Heil',        code: 'K001', brand: 'Kulmis',    category: 'Cooking Aids',        size: '50G',   unit_type: 'PC',  pieces_per_unit: 1, buy_price: 450,  sell_price: 550,  sell_price_piece: null, stock_qty: 0, min_stock: 3,  supplier_name: kulmis.name, supplier_id: kulmis.id, vat_class: 'B' },
      { name: 'Pilau Masala',         code: 'K002', brand: 'Kulmis',    category: 'Cooking Aids',        size: '100G',  unit_type: 'PC',  pieces_per_unit: 1, buy_price: 180,  sell_price: 230,  sell_price_piece: null, stock_qty: 0, min_stock: 5,  supplier_name: kulmis.name, supplier_id: kulmis.id, vat_class: 'B' },
      { name: 'Black Pepper Ground',  code: 'K003', brand: 'Kulmis',    category: 'Cooking Aids',        size: '50G',   unit_type: 'PC',  pieces_per_unit: 1, buy_price: 120,  sell_price: 160,  sell_price_piece: null, stock_qty: 0, min_stock: 5,  supplier_name: kulmis.name, supplier_id: kulmis.id, vat_class: 'B' },
    ]

    const { data: products, error: prodErr } = await supabase
      .from('products')
      .insert(productRows)
      .select()

    if (prodErr) throw prodErr

    // Map products by code for easy lookup
    const pMap = new Map(products!.map(p => [p.code, p]))

    // ── 3. Purchase orders ─────────────────────────────────────
    // Tawakall: 3 batches
    const tawakallBatches = [
      {
        supplier_name: tawakall.name, supplier_phone: tawakall.phone, supplier_id: tawakall.id,
        receipt_number: 'TWK-0001', receipt_type: 'cash_sale', receipt_date: '2026-08-10',
        total_amount: 8430, paid_amount: 8430, discount: 0, vat_total: 0,
        served_by: 'Ali', customer_name: 'Mabruk Store', notes: 'First test batch',
        items: [
          { code: 'T001', qty: 10, price: 120 },  // 1200
          { code: 'T002', qty: 4,  price: 310 },  // 1240
          { code: 'T003', qty: 2,  price: 220 },  //  440
          { code: 'T006', qty: 3,  price: 1400 }, // 4200 (3x 10KG rice bags)
          { code: 'T007', qty: 5,  price: 270 },  // 1350 (5x 2KG sugar)
        ],
      },
      {
        supplier_name: tawakall.name, supplier_phone: tawakall.phone, supplier_id: tawakall.id,
        receipt_number: 'TWK-0002', receipt_type: 'cash_sale', receipt_date: '2026-08-14',
        total_amount: 3320, paid_amount: 2000, discount: 0, vat_total: 0,
        served_by: 'Ali', customer_name: 'Mabruk Store', notes: 'Partial payment batch',
        items: [
          { code: 'T004', qty: 6,  price: 180 },  // 1080
          { code: 'T005', qty: 4,  price: 350 },  // 1400
          { code: 'T008', qty: 3,  price: 280 },  // 840 (3x Omo 1KG)
        ],
      },
      {
        supplier_name: tawakall.name, supplier_phone: tawakall.phone, supplier_id: tawakall.id,
        receipt_number: 'TWK-0003', receipt_type: 'cash_sale', receipt_date: '2026-08-18',
        total_amount: 1630, paid_amount: 0, discount: 0, vat_total: 0,
        served_by: 'Ali', customer_name: 'Mabruk Store', notes: 'Credit batch — not paid yet',
        items: [
          { code: 'T001', qty: 5,  price: 120 },  //  600
          { code: 'T002', qty: 2,  price: 310 },  //  620
          { code: 'T003', qty: 1,  price: 220 },  //  220 -- removed extra
        ],
      },
    ]

    // Fix totals to match actual line items
    tawakallBatches[0].total_amount = 10*120 + 4*310 + 2*220 + 3*1400 + 5*270  // 1200+1240+440+4200+1350 = 8430
    tawakallBatches[1].total_amount = 6*180 + 4*350 + 3*280    // 1080+1400+840 = 3320
    tawakallBatches[2].total_amount = 5*120 + 2*310 + 1*220    // 600+620+220 = 1440

    // Kulmis: 1 batch
    const kulmisBatches = [
      {
        supplier_name: kulmis.name, supplier_phone: kulmis.phone, supplier_id: kulmis.id,
        receipt_number: 'KLM-0001', receipt_type: 'cash_sale', receipt_date: '2026-08-12',
        total_amount: 0, paid_amount: 3000, discount: 0, vat_total: 0,
        served_by: 'Hassan', customer_name: 'Mabruk Store', notes: 'Spices batch',
        items: [
          { code: 'K001', qty: 5,  price: 450 },  // 2250
          { code: 'K002', qty: 6,  price: 180 },  // 1080
          { code: 'K003', qty: 8,  price: 120 },  //  960
        ],
      },
    ]
    kulmisBatches[0].total_amount = 5*450 + 6*180 + 8*120  // 2250+1080+960 = 4290

    const allBatches = [...tawakallBatches, ...kulmisBatches]

    // Insert purchase orders
    const poRows = allBatches.map(b => ({
      supplier_name: b.supplier_name,
      supplier_phone: b.supplier_phone,
      supplier_id: b.supplier_id,
      receipt_number: b.receipt_number,
      receipt_type: b.receipt_type,
      receipt_date: b.receipt_date,
      total_amount: b.total_amount,
      paid_amount: b.paid_amount,
      discount: b.discount,
      vat_total: b.vat_total,
      served_by: b.served_by,
      customer_name: b.customer_name,
      notes: b.notes,
    }))

    const { data: pos, error: poErr } = await supabase
      .from('purchase_orders')
      .insert(poRows)
      .select()

    if (poErr) throw poErr

    // Insert PO items + update stock
    for (let i = 0; i < allBatches.length; i++) {
      const batch = allBatches[i]
      const po = pos![i]

      const itemRows = batch.items.map(it => {
        const prod = pMap.get(it.code)!
        return {
          purchase_order_id: po.id,
          product_id: prod.id,
          product_name: prod.name,
          quantity: it.qty,
          buy_price: it.price,
          line_total: it.qty * it.price,
          supplier_code: it.code,
          vat_class: prod.vat_class,
          unit_type: prod.unit_type,
        }
      })

      const { error: itemErr } = await supabase
        .from('purchase_order_items')
        .insert(itemRows)

      if (itemErr) throw itemErr

      // Update product stock
      for (const it of batch.items) {
        const prod = pMap.get(it.code)!
        await supabase.rpc('increment_stock', {
          p_id: prod.id,
          qty: it.qty,
        }).then(({ error }) => {
          // If RPC doesn't exist, do manual update
          if (error) {
            return supabase
              .from('products')
              .update({ stock_qty: prod.stock_qty + it.qty })
              .eq('id', prod.id)
          }
        })
      }
    }

    // Manually accumulate stock since we might not have the RPC
    // Re-calculate from all batches
    const stockAccum = new Map<string, number>()
    for (const batch of allBatches) {
      for (const it of batch.items) {
        stockAccum.set(it.code, (stockAccum.get(it.code) || 0) + it.qty)
      }
    }

    for (const [code, totalQty] of stockAccum) {
      const prod = pMap.get(code)!
      await supabase
        .from('products')
        .update({ stock_qty: totalQty })
        .eq('id', prod.id)
    }

    // ── 4. Stock entries (for history) ─────────────────────────
    const stockRows = allBatches.flatMap((batch, i) =>
      batch.items.map(it => {
        const prod = pMap.get(it.code)!
        return {
          product_id: prod.id,
          quantity: it.qty,
          buy_price: it.price,
          supplier: batch.supplier_name,
          supplier_id: batch.supplier_id,
          notes: `Batch ${batch.receipt_number}`,
        }
      })
    )

    await supabase.from('stock_entries').insert(stockRows)

    return NextResponse.json({
      ok: true,
      summary: {
        suppliers: 2,
        products: products!.length,
        purchaseOrders: pos!.length,
        stockTotals: Object.fromEntries(stockAccum),
        tawakall: {
          batches: 3,
          totalSpent: tawakallBatches.reduce((s, b) => s + b.total_amount, 0),
          totalPaid: tawakallBatches.reduce((s, b) => s + b.paid_amount, 0),
          owed: tawakallBatches.reduce((s, b) => s + b.total_amount, 0) - tawakallBatches.reduce((s, b) => s + b.paid_amount, 0),
        },
        kulmis: {
          batches: 1,
          totalSpent: kulmisBatches[0].total_amount,
          totalPaid: kulmisBatches[0].paid_amount,
          owed: kulmisBatches[0].total_amount - kulmisBatches[0].paid_amount,
        },
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
