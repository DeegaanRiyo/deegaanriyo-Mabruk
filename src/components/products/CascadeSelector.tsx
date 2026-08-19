'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { PRODUCT_CATEGORIES } from '@/lib/types'
import { CATALOG } from '@/lib/catalog'

const PRIMARY = '#5B2A86'
const MUTED   = '#6B6373'
const INP     = 'w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg shadow-sm text-base text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition'

export interface CascadeResult {
  category: string
  brand:    string
  subtype:  string
  size:     string
}

export function CascadeSelector({ onComplete }: { onComplete: (r: CascadeResult) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [category, setCategory] = useState('')
  const [group, setGroup] = useState('')
  const [brand, setBrand] = useState('')
  const [brandCustom, setBrandCustom] = useState('')
  const [showBrandCustom, setShowBrandCustom] = useState(false)
  const [subtype, setSubtype] = useState('')
  const [subtypeCustom, setSubtypeCustom] = useState('')
  const [showSubtypeCustom, setShowSubtypeCustom] = useState(false)
  const [size, setSize] = useState('')
  const [sizeCustom, setSizeCustom] = useState('')
  const [showSizeCustom, setShowSizeCustom] = useState(false)

  const entry        = category ? CATALOG[category] : null
  const isGrouped    = !!(entry?.groups?.length)
  const activeGroup  = isGrouped ? entry!.groups!.find(g => g.label === group) : null
  const brandsForStep   = activeGroup ? activeGroup.brands   : (entry?.brands   ?? [])
  const subtypesForStep = activeGroup ? activeGroup.subtypes : (entry?.subtypes ?? [])
  const sizesForStep    = activeGroup?.sizes ?? entry?.sizes ?? []

  const activeBrand   = showBrandCustom   ? brandCustom   : brand
  const activeSubtype = showSubtypeCustom ? subtypeCustom : subtype
  const activeSize    = showSizeCustom    ? sizeCustom    : size

  const canConfirm = activeBrand.trim() && activeSubtype.trim()

  function resetBelow(fromStep: 1 | 2) {
    if (fromStep <= 1) { setCategory(''); setGroup('') }
    if (fromStep <= 2) {
      setBrand(''); setBrandCustom(''); setShowBrandCustom(false)
      setSubtype(''); setSubtypeCustom(''); setShowSubtypeCustom(false)
      setSize(''); setSizeCustom(''); setShowSizeCustom(false)
    }
  }

  function selectCategory(cat: string) {
    setCategory(cat); resetBelow(2); setGroup(''); setStep(2)
  }

  function selectGroup(g: string) {
    setGroup(g)
    setBrand(''); setBrandCustom(''); setShowBrandCustom(false)
    setSubtype(''); setSubtypeCustom(''); setShowSubtypeCustom(false)
    setSize(''); setSizeCustom(''); setShowSizeCustom(false)
    setStep(3)
  }

  function selectBrand(b: string) {
    if (b === '__other__') { setShowBrandCustom(true); setBrand('') }
    else { setShowBrandCustom(false); setBrand(b) }
  }

  function handleConfirm() {
    if (!canConfirm) return
    onComplete({
      category,
      brand:   activeBrand.trim(),
      subtype: activeSubtype.trim(),
      size:    activeSize.trim(),
    })
  }

  const STEPS = isGrouped
    ? ['Category', 'Type', 'Details']
    : ['Category', 'Brand', 'Details']

  return (
    <div className="space-y-4">

      {/* Step indicator */}
      <div className="flex items-center">
        {STEPS.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3
          const done   = step > n
          const active = step === n
          return (
            <div key={label} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                  style={{ background: done ? '#2E7D5B' : active ? PRIMARY : '#E8E3ED', color: done || active ? '#fff' : MUTED }}
                >
                  {done ? <Check size={15} strokeWidth={3} /> : n}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: active ? PRIMARY : done ? '#2E7D5B' : MUTED, marginTop: 3 }}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-[2px] mx-1 rounded" style={{ background: step > n ? '#2E7D5B' : '#E8E3ED' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Breadcrumb */}
      {step > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {category && (
            <button
              onClick={() => { setStep(1); resetBelow(1) }}
              className="px-2.5 py-1 rounded-full text-sm font-semibold transition active:scale-95"
              style={{ background: '#EDE4F5', color: PRIMARY }}
            >
              {category}
            </button>
          )}
          {group && (
            <>
              <span style={{ color: MUTED, fontSize: 14 }}>›</span>
              <button
                onClick={() => { setStep(2); resetBelow(2); setGroup('') }}
                className="px-2.5 py-1 rounded-full text-sm font-semibold transition active:scale-95"
                style={{ background: '#EDE4F5', color: PRIMARY }}
              >
                {group}
              </button>
            </>
          )}
          {!isGrouped && activeBrand && step === 3 && (
            <>
              <span style={{ color: MUTED, fontSize: 14 }}>›</span>
              <button
                onClick={() => { setStep(2); setBrand(''); setBrandCustom(''); setShowBrandCustom(false) }}
                className="px-2.5 py-1 rounded-full text-sm font-semibold transition active:scale-95"
                style={{ background: '#EDE4F5', color: PRIMARY }}
              >
                {activeBrand}
              </button>
            </>
          )}
        </div>
      )}

      {/* Step 1 — Category grid */}
      {step === 1 && (
        <div>
          <p className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: MUTED }}>Select a Category</p>
          <div className="grid grid-cols-2 gap-2">
            {PRODUCT_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => selectCategory(cat)}
                className="px-3 py-3 rounded-xl text-left text-[15px] font-semibold transition active:scale-95"
                style={{ background: '#FAF8FB', border: '1.5px solid #E8E3ED', color: '#1E1626' }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2a — Group picker */}
      {step === 2 && isGrouped && entry?.groups && (
        <div>
          <p className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: MUTED }}>What type of product?</p>
          <div className="grid grid-cols-2 gap-2">
            {entry.groups.map(g => (
              <button
                key={g.label}
                onClick={() => selectGroup(g.label)}
                className="px-3 py-3.5 rounded-xl text-left text-[15px] font-semibold transition active:scale-95"
                style={{ background: '#FAF8FB', border: '1.5px solid #E8E3ED', color: '#1E1626' }}
              >
                {g.label}
              </button>
            ))}
            <button
              onClick={() => selectGroup('Other')}
              className="px-3 py-3.5 rounded-xl text-left text-[15px] font-semibold transition active:scale-95"
              style={{ background: '#FAF8FB', border: '1.5px dashed #E8E3ED', color: MUTED }}
            >
              Other
            </button>
          </div>
        </div>
      )}

      {/* Step 2b — Brand picker (flat categories) */}
      {step === 2 && !isGrouped && entry && (
        <div className="space-y-3">
          <p className="text-sm font-bold uppercase tracking-wider" style={{ color: MUTED }}>Select Brand</p>
          <select
            value={showBrandCustom ? '__other__' : brand}
            onChange={e => selectBrand(e.target.value)}
            className={INP}
            style={{ fontSize: 16 }}
          >
            <option value="">— Choose brand —</option>
            {brandsForStep.map(b => <option key={b} value={b}>{b}</option>)}
            <option value="__other__">Other (type below)</option>
          </select>
          {showBrandCustom && (
            <input
              autoFocus
              placeholder="Type brand name..."
              value={brandCustom}
              onChange={e => setBrandCustom(e.target.value)}
              className={INP}
            />
          )}
          {activeBrand.trim() && (
            <button
              onClick={() => setStep(3)}
              className="w-full py-3 rounded-xl text-base font-bold transition active:scale-95"
              style={{ background: PRIMARY, color: '#fff' }}
            >
              Continue →
            </button>
          )}
        </div>
      )}

      {/* Step 3 — Brand (grouped) + Sub-type + Size */}
      {step === 3 && entry && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: MUTED }}>Product Details</p>

          {isGrouped && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wide mb-1 block" style={{ color: '#475569' }}>
                Brand <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={showBrandCustom ? '__other__' : brand}
                onChange={e => selectBrand(e.target.value)}
                className={INP}
              >
                <option value="">— Choose brand —</option>
                {brandsForStep.map(b => <option key={b} value={b}>{b}</option>)}
                <option value="__other__">Other (type below)</option>
              </select>
              {showBrandCustom && (
                <input
                  autoFocus
                  placeholder="Type brand name..."
                  value={brandCustom}
                  onChange={e => setBrandCustom(e.target.value)}
                  className={`${INP} mt-2`}
                />
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-1 block" style={{ color: '#475569' }}>
              Type / Sub-type <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={showSubtypeCustom ? '__other__' : subtype}
              onChange={e => {
                if (e.target.value === '__other__') { setShowSubtypeCustom(true); setSubtype('') }
                else { setShowSubtypeCustom(false); setSubtype(e.target.value) }
              }}
              className={INP}
            >
              <option value="">— Select type —</option>
              {subtypesForStep.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="__other__">Other (type below)</option>
            </select>
            {showSubtypeCustom && (
              <input
                autoFocus
                placeholder="Describe the product type..."
                value={subtypeCustom}
                onChange={e => setSubtypeCustom(e.target.value)}
                className={`${INP} mt-2`}
              />
            )}
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-1 block" style={{ color: '#475569' }}>
              Size / Weight
            </label>
            <select
              value={showSizeCustom ? '__other__' : size}
              onChange={e => {
                if (e.target.value === '__other__') { setShowSizeCustom(true); setSize('') }
                else { setShowSizeCustom(false); setSize(e.target.value) }
              }}
              className={INP}
            >
              <option value="">— Select size —</option>
              {sizesForStep.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="__other__">Other (type below)</option>
            </select>
            {showSizeCustom && (
              <input
                placeholder="e.g. 750g, 1/2 L, 24 pcs..."
                value={sizeCustom}
                onChange={e => setSizeCustom(e.target.value)}
                className={`${INP} mt-2`}
              />
            )}
          </div>

          {activeSubtype && (
            <div className="rounded-xl px-4 py-3" style={{ background: '#F7F5FA', border: '1.5px solid #E8E3ED' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: MUTED }}>Product name</p>
              <p className="text-base font-bold" style={{ color: '#1E1626' }}>
                {[activeBrand, activeSubtype, activeSize].filter(Boolean).join(' ')}
              </p>
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="w-full py-3 rounded-xl text-base font-bold transition active:scale-95 disabled:opacity-40"
            style={{ background: PRIMARY, color: '#fff' }}
          >
            Find / Create Product →
          </button>
        </div>
      )}

    </div>
  )
}
