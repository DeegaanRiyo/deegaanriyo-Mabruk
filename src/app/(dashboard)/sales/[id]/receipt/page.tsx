'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sale, SaleItem, isWeightProduct, UNIT_LABELS, UnitType } from '@/lib/types'
import { fmt } from '@/lib/utils'

const STORE_NAME    = 'MABRUUK GENERAL SHOP'
const STORE_ADDRESS = '11th Street, Hajiyusuf Avenue'
const STORE_CITY    = 'Eastleigh, Nairobi'
const STORE_PHONE   = '0729 298 175'
const STORE_AGENT   = 'Agent: 2914430 / Store: 2916186'
const STORE_BUYGOODS = 'Buy Goods: 1587693'
const STORE_BUYNAME  = 'Abdirashid'

function money(n: number | string | null | undefined) {
  return Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function refNo(id: string | null | undefined) {
  if (!id) return ''
  return id.replace(/-/g, '').slice(-8).toUpperCase()
}

function fmtDate(raw: string | null | undefined) {
  if (!raw) return ''
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${String(d.getDate()).padStart(2, '0')}-${M[d.getMonth()]}-${d.getFullYear()}`
}

function fmtTime(raw: string | null | undefined) {
  if (!raw) return ''
  const d = new Date(raw)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true })
}

type SaleItemExt = SaleItem

/** Format a sale item for receipt display.
 *  Uses sell_mode/sell_qty when available (new sales), falls back for legacy rows. */
function fmtItem(it: SaleItemExt) {
  const prod = it.products
  const isWt = prod ? isWeightProduct({ size: prod.size, pieces_per_unit: prod.pieces_per_unit }) : false
  const sellMode = it.sell_mode ?? 'piece'
  const sellQty = it.sell_qty != null ? Number(it.sell_qty) : null
  const uLbl = prod ? (UNIT_LABELS[prod.unit_type as UnitType] ?? prod.unit_type ?? '').toLowerCase() : ''

  if (sellMode === 'unit' && sellQty != null) {
    // Sold as full/half unit — show "1 carton x Dove Soap 135G" or "½ bag x Sugar 50KG"
    const qStr = sellQty === 0.5 ? '½' : String(sellQty)
    const name = `${prod?.name ?? '---'}${prod?.size ? ` ${prod.size}` : ''}`
    const qtyLabel = `${qStr} ${uLbl}`
    const displayPrice = sellQty > 0 ? Number(it.line_total) / sellQty : Number(it.unit_price)
    return { name, qtyLabel, q: sellQty, displayPrice }
  }

  if (isWt) {
    // Sold by KG
    const q = sellQty ?? (Number(it.quantity) || 1)
    const name = prod?.name ?? '---'
    const qtyLabel = `${q === 0.5 ? '½' : q} KG`
    return { name, qtyLabel, q, displayPrice: Number(it.unit_price) }
  }

  // Sold by piece (or legacy row)
  const q = sellQty ?? (Number(it.quantity) || 1)
  const name = `${prod?.name ?? '---'}${prod?.size ? ` ${prod.size}` : ''}`
  const qtyLabel = String(q)
  return { name, qtyLabel, q, displayPrice: Number(it.unit_price) }
}

function txLabel(method: string | null) {
  if (method === 'split') return 'Cash + M-Pesa'
  if (method === 'mpesa') return 'M-Pesa Sale'
  return 'Cash Sale'
}

function buildWhatsAppText(sale: Sale, items: SaleItemExt[]): string {
  const L: string[] = [
    `*${STORE_NAME}*`,
    `Receipt #${refNo(sale.id)}`,
    `${fmtDate(sale.created_at)} ${fmtTime(sale.created_at)}`,
  ]
  if (sale.client_name) L.push(`Customer: ${sale.client_name}${sale.client_phone ? ` (${sale.client_phone})` : ''}`)
  L.push('---')
  items.forEach(it => {
    const { name, qtyLabel } = fmtItem(it)
    L.push(`${qtyLabel} x ${name} = *${fmt(it.line_total)}*`)
  })
  const paid = Number(sale.paid_amount ?? 0)
  const bal = Number(sale.total) - paid
  L.push('---')
  L.push(`*TOTAL: KES ${fmt(Number(sale.total))}*`)
  L.push(`Paid: KES ${fmt(paid)}${sale.method ? ` (${txLabel(sale.method)})` : ''}`)
  if (bal > 0) L.push(`*Balance: KES ${fmt(bal)}*`)
  if (sale.mpesa_ref) L.push(`Ref: ${sale.mpesa_ref}`)
  L.push('')
  L.push(`*${STORE_BUYGOODS}*`)
  L.push(`Tel: ${STORE_PHONE}`)
  L.push(`_Thank you — ${STORE_NAME}_`)
  return L.join('\n')
}

// ── Receipt preview (screen) ────────────────────────────────────────────────
function ReceiptContent({ sale, items, servedBy }: {
  sale: Sale; items: SaleItemExt[]; servedBy: string
}) {
  const total = Number(sale.total) || 0
  const paid = Number(sale.paid_amount) || 0
  const bal = total - paid
  const itemCount = items.length

  const dash = { border: 'none', borderTop: '1px dashed #aaa', margin: '4px 0' } as const
  const row = (a: string, b: string, bold = false, color = '#000') => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: bold ? 800 : 600, fontSize: bold ? 13 : 12, color, lineHeight: 1.5 }}>
      <span>{a}</span><span>{b}</span>
    </div>
  )

  return (
    <div style={{ fontFamily: "'Calibri','Trebuchet MS',sans-serif", fontSize: 12, color: '#000', lineHeight: 1.4 }}>

      {/* Store header */}
      <div style={{ textAlign: 'center', marginBottom: 2 }}>
        <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: 1.5 }}>{STORE_NAME}</div>
        <div style={{ fontSize: 10, color: '#555' }}>{STORE_ADDRESS}, {STORE_CITY}</div>
        <div style={{ fontSize: 12, fontWeight: 700 }}>Tel: {STORE_PHONE}</div>
        <div style={{ fontSize: 9, color: '#666' }}>{STORE_AGENT}</div>
        <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 0.5, marginTop: 2 }}>{STORE_BUYGOODS}</div>
      </div>

      <hr style={dash} />

      {/* Ref + meta — compact */}
      <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 14, letterSpacing: 3, margin: '2px 0' }}>
        *{refNo(sale.id)}*
      </div>
      <div style={{ fontSize: 11, color: '#444', lineHeight: 1.5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700 }}>{txLabel(sale.method)}</span>
          <span>{fmtDate(sale.created_at)} {fmtTime(sale.created_at)}</span>
        </div>
        {(sale.client_name || sale.client_phone) && (
          <div>
            {sale.client_name}{sale.client_phone ? ` · ${sale.client_phone}` : ''}
          </div>
        )}
      </div>

      <hr style={dash} />

      {/* Items — compact two-line per item, no extra borders */}
      {items.map(it => {
        const { name, qtyLabel, displayPrice } = fmtItem(it)
        const lt = Number(it.line_total) || 0
        return (
          <div key={it.id} style={{ marginBottom: 3 }}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>{name}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#555' }}>
              <span>{qtyLabel} x {money(displayPrice)}</span>
              <span style={{ fontWeight: 800, color: '#000' }}>{money(lt)}</span>
            </div>
          </div>
        )
      })}

      <hr style={{ ...dash, borderTop: '1.5px dashed #888' }} />

      {/* Totals */}
      {row('TOTAL', `KES ${money(total)}`, true)}
      {sale.method === 'split' ? (
        <>
          {row('Cash', `KES ${money(sale.cash_amount)}`)}
          {row('M-Pesa', `KES ${money(sale.mpesa_amount)}`)}
        </>
      ) : (
        row(`Paid (${sale.method === 'mpesa' ? 'M-Pesa' : 'Cash'})`, `KES ${money(paid)}`)
      )}
      {(bal > 0 || (paid > total)) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 13, color: bal > 0 ? '#B23A3A' : '#2E7D5B', lineHeight: 1.5 }}>
          <span>{bal > 0 ? 'BALANCE' : 'CHANGE'}</span>
          <span>KES {money(Math.abs(bal))}</span>
        </div>
      )}
      <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
        Items: {itemCount}{sale.mpesa_ref ? ` | Ref: ${sale.mpesa_ref}` : ''}
      </div>

      <hr style={dash} />

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: 11, marginBottom: 2 }}>Thank you for shopping with us!</div>
      {servedBy && <div style={{ fontSize: 10 }}>Served by: <b>{servedBy}</b></div>}
      <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>Goods once sold are not returnable</div>
      <div style={{ textAlign: 'center', fontSize: 8, color: '#aaa', marginTop: 4 }}>Powered by Riyo Technology</div>
    </div>
  )
}

// ── Print HTML ──────────────────────────────────────────────────────────────
function buildPrintHTML(sale: Sale, items: SaleItemExt[], servedBy: string, paperSize: '58' | '80'): string {
  const total = Number(sale.total) || 0
  const paid = Number(sale.paid_amount) || 0
  const bal = total - paid
  const itemCount = items.length
  const is58 = paperSize === '58'
  const esc = (s: string | null | undefined) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const itemRows = items.map(it => {
    const { name, qtyLabel, displayPrice } = fmtItem(it)
    const lt = Number(it.line_total) || 0
    return `<div style="margin-bottom:3px"><div style="font-weight:700">${esc(name)}</div><div class="r" style="font-size:${is58?'8pt':'8.5pt'};color:#555"><span>${qtyLabel} x ${money(displayPrice)}</span><span style="font-weight:800;color:#000">${money(lt)}</span></div></div>`
  }).join('')

  const customerLine = sale.client_name ? `<div>${esc(sale.client_name)}${sale.client_phone ? ` &middot; ${esc(sale.client_phone)}` : ''}</div>` : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
@page{size:${paperSize}mm auto;margin:0}
@media print{@page{margin:0}html,body{margin:0;padding:3mm}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{margin:0;padding:3mm;height:auto}
body{font-family:'Calibri','Trebuchet MS',sans-serif;font-size:${is58?'9pt':'9.5pt'};width:${is58?'52mm':'72mm'};line-height:1.4;color:#000}
.b{font-weight:900}.c{text-align:center}
.r{display:flex;justify-content:space-between;line-height:1.5}
hr{border:none;border-top:1px dashed #aaa;margin:4px 0}
</style></head><body>
<div class="c"><div class="b" style="font-size:1.2em;letter-spacing:1.5px">${esc(STORE_NAME)}</div>
<div style="font-size:0.8em;color:#555">${esc(STORE_ADDRESS)}, ${esc(STORE_CITY)}</div>
<div style="font-size:0.95em;font-weight:700">Tel: ${esc(STORE_PHONE)}</div>
<div style="font-size:0.72em;color:#666">${esc(STORE_AGENT)}</div>
<div style="font-size:1.05em;font-weight:900;margin-top:2px">${esc(STORE_BUYGOODS)}</div></div>
<hr/>
<div class="c b" style="font-size:1.15em;letter-spacing:3px;margin:2px 0">*${refNo(sale.id)}*</div>
<div style="font-size:0.88em;color:#444">
<div class="r"><span style="font-weight:700">${txLabel(sale.method)}</span><span>${fmtDate(sale.created_at)} ${fmtTime(sale.created_at)}</span></div>
${customerLine}</div>
<hr/>
${itemRows}
<hr style="border-top:1.5px dashed #888"/>
<div class="r b" style="font-size:1.05em""><span>TOTAL</span><span>KES ${money(total)}</span></div>
${sale.method === 'split' ? `<div class="r" style="font-weight:600"><span>Cash</span><span>KES ${money(sale.cash_amount)}</span></div><div class="r" style="font-weight:600"><span>M-Pesa</span><span>KES ${money(sale.mpesa_amount)}</span></div>` : `<div class="r" style="font-weight:600"><span>Paid (${sale.method === 'mpesa' ? 'M-Pesa' : 'Cash'})</span><span>KES ${money(paid)}</span></div>`}
${bal > 0 ? `<div class="r b" style="color:#B23A3A"><span>BALANCE</span><span>KES ${money(bal)}</span></div>` : paid > total ? `<div class="r b" style="color:#2E7D5B"><span>CHANGE</span><span>KES ${money(paid - total)}</span></div>` : ''}
<div style="font-size:0.8em;color:#666;margin-top:2px">Items: ${itemCount}${sale.mpesa_ref ? ` | Ref: ${esc(sale.mpesa_ref)}` : ''}</div>
<hr/>
<div class="c" style="font-size:0.9em;margin-bottom:2px">Thank you for shopping with us!</div>
${servedBy ? `<div style="font-size:0.82em">Served by: <b>${esc(servedBy)}</b></div>` : ''}
<div style="font-size:0.72em;color:#888;margin-top:2px">Goods once sold are not returnable</div>
<div class="c" style="font-size:0.65em;color:#aaa;margin-top:4px">Powered by Riyo Technology</div>
<script>window.onload=function(){window.print();window.close()}<\/script>
</body></html>`
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function ReceiptPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [sale, setSale] = useState<Sale | null>(null)
  const [items, setItems] = useState<SaleItemExt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paperSize, setPaperSize] = useState<'58' | '80'>('80')
  const [servedBy, setServedBy] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: i }] = await Promise.all([
        supabase.from('sales').select('*').eq('id', params.id).single(),
        supabase.from('sale_items').select('*, products(name, unit_type, size, code, pieces_per_unit)').eq('sale_id', params.id),
      ])
      if (!s) { setError('Sale not found'); setLoading(false); return }
      setSale(s as Sale)
      setItems((i ?? []) as SaleItemExt[])
      setLoading(false)
    }
    load()
  }, [params.id]) // eslint-disable-line

  function handlePrint() {
    if (!sale) return
    const html = buildPrintHTML(sale, items, servedBy, paperSize)

    // Use a hidden iframe — avoids popup blockers and prints directly
    // to the default printer (the receipt/thermal printer).
    let frame = document.getElementById('receipt-print-frame') as HTMLIFrameElement | null
    if (!frame) {
      frame = document.createElement('iframe')
      frame.id = 'receipt-print-frame'
      frame.style.cssText = 'position:fixed;width:0;height:0;border:none;left:-9999px;top:-9999px'
      document.body.appendChild(frame)
    }
    const doc = frame.contentDocument || frame.contentWindow?.document
    if (!doc) { alert('Could not access print frame'); return }
    doc.open()
    doc.write(html.replace(/<script>.*<\/script>/g, ''))  // strip auto-print script
    doc.close()
    // Wait for content to render, then print
    setTimeout(() => {
      frame!.contentWindow?.print()
    }, 250)
  }

  function handleWhatsApp() {
    if (!sale) return
    const phone = sale.client_phone ? sale.client_phone.replace(/\D/g, '').replace(/^0/, '254') : ''
    const text = encodeURIComponent(buildWhatsAppText(sale, items))
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank')
  }

  if (loading) return <div style={{ padding: 48, color: '#9CA3AF', textAlign: 'center', fontFamily: 'sans-serif' }}>Loading receipt...</div>
  if (error || !sale) return <div style={{ padding: 48, color: '#dc2626', textAlign: 'center', fontFamily: 'sans-serif' }}>{error ?? 'Not found'}</div>

  return (
    <>
      {/* Top bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: '#1E1626', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', gap: 10, flexWrap: 'wrap',
      }}>
        <button onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 13, cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 700 }}>
          &larr; Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Paper size */}
          <div style={{ display: 'inline-flex', background: '#2D2438', borderRadius: 6, padding: 2, gap: 2 }}>
            {(['58', '80'] as const).map(s => (
              <button key={s} onClick={() => setPaperSize(s)}
                style={{
                  padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 800, fontFamily: 'sans-serif',
                  background: paperSize === s ? '#5B2A86' : 'transparent',
                  color: paperSize === s ? '#fff' : '#9CA3AF',
                }}>{s}mm</button>
            ))}
          </div>

          {/* Served by */}
          <input type="text" placeholder="Served by" value={servedBy}
            onChange={e => setServedBy(e.target.value)}
            style={{
              width: 100, padding: '4px 8px',
              background: '#2D2438', border: '1px solid #3D3448',
              borderRadius: 6, fontSize: 12, color: '#fff', fontFamily: 'sans-serif', fontWeight: 600,
            }} />
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleWhatsApp}
            style={{
              background: '#25d366', color: '#fff', border: 'none',
              padding: '7px 14px', borderRadius: 8, fontFamily: 'sans-serif',
              fontSize: 12, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Send
          </button>
          <button onClick={handlePrint}
            style={{ background: '#5B2A86', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 8, fontFamily: 'sans-serif', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
            Print
          </button>
          <button onClick={() => router.back()}
            style={{ background: '#374151', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: 8, fontFamily: 'sans-serif', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>

      {/* Preview */}
      <div style={{ paddingTop: 64, paddingBottom: 32, background: '#f1f5f9', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ marginBottom: 8, fontFamily: 'sans-serif', fontSize: 10, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
          {paperSize}mm preview
        </div>
        <div style={{
          background: '#fff', padding: '12px 14px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)', borderRadius: 3,
          width: paperSize === '58' ? 230 : 310,
        }}>
          <ReceiptContent sale={sale} items={items} servedBy={servedBy} />
        </div>
      </div>
    </>
  )
}
