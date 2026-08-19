'use client'

import { useState, useEffect } from 'react'
import { Product, isMultiUnit, UNIT_LABELS, UnitType } from '@/lib/types'
import { fmt } from '@/lib/utils'

const MUTED       = '#6B6373'
const INP         = 'w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg shadow-sm text-base text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition'

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

export type StockForm = { quantity: string; buy_price: string; supplier: string }
export const emptyStock: StockForm = { quantity: '', buy_price: '', supplier: '' }

export function StockInForm({
  product, onSave, saving, success,
}: {
  product: Product
  onSave:  (f: StockForm) => Promise<void>
  saving:  boolean
  success: string
}) {
  const [form, setForm]           = useState<StockForm>(emptyStock)
  const [entryMode, setEntryMode] = useState<'unit' | 'piece'>('unit')

  const isMulti = isMultiUnit(product)
  const ppu     = product.pieces_per_unit || 1
  const unitLabel = UNIT_LABELS[product.unit_type as UnitType] || product.unit_type

  useEffect(() => { if (success) setForm(emptyStock) }, [success])

  const rawQty     = parseFloat(form.quantity) || 0
  const rawBuy     = parseFloat(form.buy_price) || 0
  const actualUnits = isMulti && entryMode === 'unit' ? rawQty * ppu : rawQty
  const lineTotal  = rawQty * rawBuy

  return (
    <div className="space-y-3">

      {success && (
        <div className="rounded-lg px-3 py-2 text-sm font-medium"
          style={{ background: '#E3F3EC', color: '#2E7D5B', border: '1px solid #A8D5BE' }}>
          {success}
        </div>
      )}

      {/* Entry mode toggle — multi-unit products only */}
      {isMulti && ppu > 1 && (
        <div className="flex gap-2">
          {(['unit', 'piece'] as const).map(m => {
            const active = entryMode === m
            return (
              <button key={m} type="button"
                onClick={() => { setEntryMode(m); setForm(emptyStock) }}
                className="flex-1 py-2 rounded-xl text-base font-bold transition active:scale-95"
                style={{ background: active ? '#B8791C' : '#FAF8FB', color: active ? '#fff' : '#B8791C', border: '1.5px solid #B8791C' }}>
                {m === 'unit' ? `By ${unitLabel}` : 'By Pieces'}
              </button>
            )
          })}
        </div>
      )}

      {/* Qty + Price */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Field label={isMulti && entryMode === 'unit' ? `No. of ${unitLabel}s` : 'Quantity (pcs)'} required>
            <input type="number" min={isMulti && entryMode === 'unit' ? '0.5' : '1'} step={isMulti && entryMode === 'unit' ? '0.5' : '1'} inputMode="decimal"
              value={form.quantity}
              onChange={e => setForm({ ...form, quantity: e.target.value })}
              placeholder="—"
              className={`${INP} text-center font-bold text-lg`} />
          </Field>
          {isMulti && entryMode === 'unit' && rawQty > 0 && ppu > 1 && (
            <p style={{ fontSize: 13, color: '#B8791C', fontWeight: 600, marginTop: 4, paddingLeft: 4 }}>
              = {rawQty * ppu} pieces
            </p>
          )}
        </div>
        <div>
          <Field label={isMulti && entryMode === 'unit' ? `Cost / ${unitLabel} (KES)` : 'Cost / Piece (KES)'}>
            <input type="number" min="0" step="0.01" inputMode="decimal"
              value={form.buy_price}
              onChange={e => setForm({ ...form, buy_price: e.target.value })}
              placeholder="—"
              className={`${INP} text-center font-bold text-lg`} />
          </Field>
          {isMulti && entryMode === 'unit' && rawBuy > 0 && ppu > 1 && (
            <p style={{ fontSize: 13, color: MUTED, marginTop: 4, paddingLeft: 4 }}>
              = KES {(rawBuy / ppu).toFixed(0)}/piece
            </p>
          )}
        </div>
      </div>

      {/* Line total */}
      {rawQty > 0 && rawBuy > 0 && (
        <div className="rounded-lg px-3 py-2 flex items-center justify-between" style={{ background: '#1E1626' }}>
          <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#EDE4F5' }}>
            Line Total
          </span>
          <span className="tabnum" style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
            KES {fmt(lineTotal)}
          </span>
        </div>
      )}

      {/* Supplier */}
      <Field label="Supplier (optional)">
        <input
          placeholder={product.supplier_name || 'Supplier name'}
          value={form.supplier}
          onChange={e => setForm({ ...form, supplier: e.target.value })}
          className={INP}
        />
      </Field>

      <button
        onClick={() => {
          const buyPricePerPiece = isMulti && entryMode === 'unit' && ppu > 1
            ? rawBuy / ppu
            : rawBuy
          onSave({ ...form, quantity: String(actualUnits), buy_price: String(buyPricePerPiece) })
        }}
        disabled={saving || !form.quantity || rawQty <= 0}
        className="w-full bg-primary text-white rounded-xl py-3 text-base font-bold disabled:opacity-50 active:scale-95 transition"
      >
        {saving ? 'Adding...' : isMulti && entryMode === 'unit'
          ? `Add ${form.quantity || 0} ${unitLabel}${Number(form.quantity) !== 1 ? 's' : ''} (${rawQty * ppu} pcs)`
          : `Add ${form.quantity || 0} pcs`}
      </button>

    </div>
  )
}
