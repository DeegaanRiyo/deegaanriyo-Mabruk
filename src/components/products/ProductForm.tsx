'use client'

import { useState, useEffect } from 'react'
import { PRODUCT_CATEGORIES, UnitType, UNIT_TYPES, UNIT_LABELS, isMultiUnit } from '@/lib/types'
import { fmt } from '@/lib/utils'

const PRIMARY = '#5B2A86'
const MUTED   = '#6B6373'
const INP     = 'w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg shadow-sm text-base text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide mb-1 block" style={{ color: '#475569' }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

function Sep({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      {label && <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, whiteSpace: 'nowrap' }}>{label}</span>}
      <div style={{ flex: 1, height: 1, background: '#E8E3ED' }} />
    </div>
  )
}

export type FormState = {
  name: string; code: string; brand: string; category: string; size: string
  unit_type: UnitType; pieces_per_unit: string
  buy_price: string; sell_price: string; sell_price_piece: string
  price_mode: 'unit' | 'piece'
  min_stock: string; supplier_name: string
  opening_qty: string
}

export const emptyForm: FormState = {
  name: '', code: '', brand: '', category: '', size: '',
  unit_type: 'PC', pieces_per_unit: '1',
  buy_price: '', sell_price: '', sell_price_piece: '',
  price_mode: 'unit', min_stock: '5', supplier_name: '',
  opening_qty: '',
}

export function ProductForm({
  initial, onSave, saving, isNew, lockUnitType,
}: {
  initial: FormState
  onSave: (f: FormState) => Promise<void>
  saving: boolean
  isNew?: boolean
  lockUnitType?: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)
  useEffect(() => { setForm(initial) }, [initial]) // eslint-disable-line

  const isMulti        = isMultiUnit({ pieces_per_unit: parseInt(form.pieces_per_unit) || 1 })
  const ppu            = parseInt(form.pieces_per_unit) || 1
  const rawBuy         = parseFloat(form.buy_price) || 0
  const costPerPiece   = isMulti && ppu > 1 ? rawBuy / ppu : rawBuy
  const sellPrice      = parseFloat(form.sell_price) || 0
  const sellPricePerPiece = isMulti
    ? form.price_mode === 'piece' ? sellPrice : (ppu > 0 ? sellPrice / ppu : 0)
    : sellPrice
  const marginPerPiece = sellPricePerPiece - costPerPiece
  const marginPct      = costPerPiece > 0 ? (marginPerPiece / costPerPiece) * 100 : 0
  const openingQty     = parseInt(form.opening_qty) || 0
  const openingPcs     = isMulti ? openingQty * ppu : openingQty
  const openingValue   = openingPcs * costPerPiece
  const unitLabel      = UNIT_LABELS[form.unit_type] || form.unit_type

  return (
    <div className="space-y-2">

      {/* Opening stock strip */}
      {isNew && (
        <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: '#F0FBF6' }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2E7D5B', whiteSpace: 'nowrap' }}>Stock in</span>
          {!isMulti ? (
            <input
              type="number" min="0" step="1" inputMode="numeric"
              value={form.opening_qty}
              onChange={e => setForm({ ...form, opening_qty: e.target.value })}
              placeholder="0"
              className="w-14 px-2 py-1 text-base font-bold text-center bg-white border border-[#A8D5BE] rounded-md focus:outline-none focus:border-[#2E7D5B] transition"
            />
          ) : (
            <span className="tabnum" style={{ fontSize: 15, fontWeight: 700, color: '#2E7D5B' }}>
              {openingQty > 0 ? `${openingQty} ${unitLabel}${openingQty !== 1 ? 's' : ''} = ${openingPcs} pcs` : `enter ${unitLabel.toLowerCase()}s below`}
            </span>
          )}
          <span style={{ fontSize: 14, color: '#2E7D5B', flex: 1 }}>{!isMulti ? 'pcs' : ''}</span>
          {openingPcs > 0 && costPerPiece > 0 && (
            <span className="tabnum" style={{ fontSize: 14, fontWeight: 800, color: '#1E1626' }}>KES {fmt(openingValue)}</span>
          )}
        </div>
      )}

      {/* ── Product ── */}
      <Sep label="Product" />

      <div className="grid grid-cols-[1fr,auto] gap-2">
        <Field label="Name" required>
          <input
            placeholder="e.g. Green Gram (Ndengu)" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className={INP} style={{ fontWeight: 600 }}
          />
        </Field>
        <Field label="Code">
          <input placeholder="SKU" value={form.code}
            onChange={e => setForm({ ...form, code: e.target.value })}
            className={INP} style={{ width: 90, textAlign: 'center', fontFamily: 'monospace' }} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Brand">
          <input placeholder="Dola, Ajab…" value={form.brand}
            onChange={e => setForm({ ...form, brand: e.target.value })} className={INP} />
        </Field>
        <Field label="Size">
          <input placeholder="500g, 1kg…" value={form.size}
            onChange={e => setForm({ ...form, size: e.target.value })} className={INP} />
        </Field>
        <Field label="Category">
          <select value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })} className={INP}>
            <option value="">Select…</option>
            {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Supplier">
          <input placeholder="Supplier" value={form.supplier_name}
            onChange={e => setForm({ ...form, supplier_name: e.target.value })} className={INP} />
        </Field>
      </div>

      {/* ── Unit ── */}
      <Sep label="Unit" />

      {lockUnitType ? (
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Record as</span>
          <span className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-[13px] font-bold"
            style={{ background: PRIMARY, color: '#fff' }}>
            {unitLabel}
          </span>
          <span style={{ fontSize: 12, color: MUTED }}>— set by catalog selection</span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Record as</span>
            <div className="inline-flex p-0.5 rounded-lg" style={{ background: '#EDE4F5', gap: 2 }}>
              <button type="button"
                onClick={() => setForm({ ...form, unit_type: 'PC', pieces_per_unit: '1', buy_price: '', sell_price: '', sell_price_piece: '', price_mode: 'unit' })}
                className="h-8 px-3 rounded-md text-[13px] font-bold transition active:scale-95"
                style={{ background: form.unit_type === 'PC' && !isMulti ? PRIMARY : 'transparent', color: form.unit_type === 'PC' && !isMulti ? '#fff' : MUTED, border: 'none', cursor: 'pointer' }}>
                Piece
              </button>
              <button type="button"
                onClick={() => setForm({ ...form, unit_type: form.unit_type === 'PC' ? 'CTN' : form.unit_type, pieces_per_unit: form.pieces_per_unit === '1' ? '' : form.pieces_per_unit, buy_price: '', sell_price: '', sell_price_piece: '', price_mode: 'unit' })}
                className="h-8 px-3 rounded-md text-[13px] font-bold transition active:scale-95"
                style={{ background: isMulti || form.unit_type !== 'PC' ? PRIMARY : 'transparent', color: isMulti || form.unit_type !== 'PC' ? '#fff' : MUTED, border: 'none', cursor: 'pointer' }}>
                Multi-unit
              </button>
            </div>
          </div>
          {/* Unit type dropdown for multi-unit */}
          {(isMulti || form.unit_type !== 'PC') && (
            <div className="flex items-center gap-2">
              <select
                value={form.unit_type}
                onChange={e => setForm({ ...form, unit_type: e.target.value as UnitType })}
                className="px-2 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-sm font-semibold focus:outline-none focus:border-[#5B2A86]"
              >
                {UNIT_TYPES.filter(u => u !== 'PC').map(u => (
                  <option key={u} value={u}>{UNIT_LABELS[u]} ({u})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Multi-unit: pcs per unit + opening stock */}
      {isMulti && (
        <div className={`grid gap-2 ${isNew ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <Field label={`Pieces per ${unitLabel.toLowerCase()} *`}>
            <div className="flex items-center gap-1.5">
              <input type="number" min="1" step="1" inputMode="numeric"
                value={form.pieces_per_unit}
                onChange={e => setForm({ ...form, pieces_per_unit: e.target.value })}
                placeholder="24" className={`${INP} text-center font-bold`} />
              {ppu > 1 && <span style={{ fontSize: 13, color: PRIMARY, fontWeight: 700, whiteSpace: 'nowrap' }}>{ppu} pcs</span>}
            </div>
          </Field>
          {isNew && (
            <Field label={`Opening stock (${unitLabel.toLowerCase()}s)`}>
              <input type="number" min="0" step="0.5" inputMode="decimal"
                value={form.opening_qty}
                onChange={e => setForm({ ...form, opening_qty: e.target.value })}
                placeholder="0" className={`${INP} text-center font-bold`} />
            </Field>
          )}
        </div>
      )}

      {/* ── Pricing ── */}
      <Sep label="Pricing" />

      {isMulti ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label={`Cost / ${unitLabel} (KES)`} required>
              <input type="number" min="0" step="0.01" inputMode="decimal"
                value={form.buy_price}
                onChange={e => setForm({ ...form, buy_price: e.target.value })}
                placeholder="—" className={`${INP} font-bold`} />
            </Field>
            <Field label="Low Stock Alert">
              <div className="flex items-center gap-1">
                <input type="number" min="0" step="1" inputMode="numeric"
                  value={form.min_stock}
                  onChange={e => setForm({ ...form, min_stock: e.target.value })}
                  placeholder="5" className={`${INP} text-center`} />
                <span style={{ fontSize: 13, color: MUTED }}>pcs</span>
              </div>
            </Field>
          </div>

          {rawBuy > 0 && ppu > 1 && (
            <p style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>
              Cost/pc: KES {rawBuy.toFixed(0)} ÷ {ppu} = <strong style={{ color: PRIMARY }}>KES {costPerPiece.toFixed(0)}</strong>
            </p>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>
                Sell Price (KES) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div className="flex p-0.5 rounded-md" style={{ background: '#EDE4F5', gap: 2 }}>
                {(['unit', 'piece'] as const).map(m => (
                  <button key={m} type="button"
                    onClick={() => setForm({ ...form, price_mode: m, sell_price: form.sell_price_piece || '', sell_price_piece: form.sell_price || '' })}
                    className="h-6 px-2 rounded text-xs font-bold transition"
                    style={{ background: form.price_mode === m ? PRIMARY : 'transparent', color: form.price_mode === m ? '#fff' : MUTED, border: 'none', cursor: 'pointer' }}>
                    / {m === 'unit' ? unitLabel : 'Pc'}
                  </button>
                ))}
              </div>
            </div>
            <input type="number" min="0" step="0.01" inputMode="decimal"
              value={form.sell_price}
              onChange={e => setForm({ ...form, sell_price: e.target.value })}
              placeholder="—" className={`${INP} font-bold w-full`} />
            {sellPrice > 0 && ppu > 1 && (
              <p style={{ fontSize: 13, fontWeight: 600, color: PRIMARY, marginTop: 3 }}>
                {form.price_mode === 'unit'
                  ? `= KES ${(sellPrice / ppu).toFixed(0)} / piece`
                  : `= KES ${(sellPrice * ppu).toFixed(0)} / ${unitLabel.toLowerCase()}`}
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Cost (KES)">
              <input type="number" min="0" step="0.01" inputMode="decimal"
                value={form.buy_price}
                onChange={e => setForm({ ...form, buy_price: e.target.value })}
                placeholder="—" className={`${INP} font-bold`} />
            </Field>
            <Field label="Sell (KES)" required>
              <input type="number" min="0" step="0.01" inputMode="decimal"
                value={form.sell_price}
                onChange={e => setForm({ ...form, sell_price: e.target.value })}
                placeholder="—" className={`${INP} font-bold`} />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Low stock</span>
            <input type="number" min="0" step="1" inputMode="numeric"
              value={form.min_stock}
              onChange={e => setForm({ ...form, min_stock: e.target.value })}
              placeholder="5" className={`${INP} text-center`} style={{ width: 60 }} />
            <span style={{ fontSize: 13, color: MUTED }}>pcs</span>
          </div>
        </>
      )}

      {/* Margin */}
      {sellPricePerPiece > 0 && costPerPiece > 0 && (
        <div className="flex items-center justify-between rounded-lg px-3 py-1.5"
          style={{ background: marginPerPiece >= 0 ? '#E3F3EC' : '#FEE2E2' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: marginPerPiece >= 0 ? '#2E7D5B' : '#991B1B' }}>
            Margin{isMulti ? ' / pc' : ''}
          </span>
          <span className="tabnum" style={{ fontSize: 15, fontWeight: 800, color: marginPerPiece >= 0 ? '#2E7D5B' : '#991B1B' }}>
            KES {marginPerPiece.toFixed(0)} · {marginPct.toFixed(0)}%
          </span>
        </div>
      )}

      {/* Save */}
      <button
        onClick={() => onSave(form)}
        disabled={saving || !form.name || !form.sell_price || !form.buy_price}
        className="w-full rounded-lg py-2.5 text-base font-bold disabled:opacity-40 active:scale-95 transition"
        style={{ background: PRIMARY, color: '#fff' }}
      >
        {saving ? 'Saving…' : isNew ? 'Save & Add to Inventory' : 'Save Changes'}
      </button>

    </div>
  )
}
