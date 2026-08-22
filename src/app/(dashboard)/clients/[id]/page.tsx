'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Client, Credit, Sale } from '@/lib/types'
import { fmt, fmtDate, fmtTime } from '@/lib/utils'
import { ArrowLeft, Phone, ShoppingCart, Check, Edit2, X } from 'lucide-react'

const C = {
  bg: '#FAF8FB', surface: '#FFFFFF', fg: '#1E1626',
  primary: '#5B2A86', primaryLight: '#EDE4F5',
  muted: '#6B6373', border: '#E8E3ED',
  success: '#2E7D5B', successLight: '#E3F3EC',
  danger: '#B23A3A', dangerLight: '#FBE9E9',
  warning: '#B8791C', warningLight: '#FBF0DC',
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [client, setClient] = useState<Client | null>(null)
  const [credits, setCredits] = useState<Credit[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  // Payment state
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<'cash' | 'mpesa'>('cash')
  const [payProcessing, setPayProcessing] = useState(false)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Tab
  const [tab, setTab] = useState<'credits' | 'sales'>('credits')

  useEffect(() => { loadAll() }, [id]) // eslint-disable-line

  async function loadAll() {
    setLoading(true)
    const [clientRes, creditsRes, salesRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('credits').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('sales').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    ])
    if (clientRes.data) {
      const c = clientRes.data as Client
      setClient(c)
      setEditName(c.name)
      setEditPhone(c.phone || '')
      setEditNotes(c.notes || '')
    }
    setCredits((creditsRes.data ?? []) as Credit[])
    setSales((salesRes.data ?? []) as Sale[])
    setLoading(false)
  }

  async function handlePayment(credit: Credit) {
    const amount = parseFloat(payAmount)
    if (!amount || amount <= 0 || payProcessing) return
    setPayProcessing(true)
    const { error } = await supabase.rpc('record_credit_payment', {
      p_credit_id: credit.id,
      p_amount: amount,
      p_method: payMethod,
    })
    setPayProcessing(false)
    if (error) { alert('Payment failed: ' + error.message); return }
    setPayingId(null)
    setPayAmount('')
    loadAll()
  }

  async function saveEdit() {
    if (!editName.trim() || editSaving) return
    setEditSaving(true)
    const { error } = await supabase.from('clients').update({
      name: editName.trim(),
      phone: editPhone.trim() || null,
      notes: editNotes.trim() || null,
    }).eq('id', id)
    setEditSaving(false)
    if (error) { alert('Failed: ' + error.message); return }
    setEditing(false)
    loadAll()
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 rounded-lg" style={{ background: C.border }} />
          <div className="h-24 rounded-xl" style={{ background: C.border }} />
          <div className="h-40 rounded-xl" style={{ background: C.border }} />
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="p-4 text-center py-12">
        <p className="text-sm" style={{ color: C.muted }}>Client not found</p>
        <button onClick={() => router.push('/clients')} className="mt-3 text-sm font-bold" style={{ color: C.primary }}>
          Back to Clients
        </button>
      </div>
    )
  }

  const pendingCredits = credits.filter(c => !c.is_settled)
  const settledCredits = credits.filter(c => c.is_settled)
  const totalOwed = pendingCredits.reduce((s, c) => s + (Number(c.amount) - Number(c.paid)), 0)

  return (
    <div className="p-4 space-y-4">
      {/* Back button */}
      <button
        onClick={() => router.push('/clients')}
        className="flex items-center gap-1.5 text-sm font-bold transition active:scale-95"
        style={{ color: C.primary }}
      >
        <ArrowLeft size={16} /> Clients
      </button>

      {/* Client header */}
      <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {editing ? (
          <div className="space-y-3">
            <input value={editName} onChange={e => setEditName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#5B2A86]/30"
              style={{ border: `1.5px solid ${C.border}` }} placeholder="Name" />
            <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5B2A86]/30"
              style={{ border: `1.5px solid ${C.border}` }} placeholder="Phone" />
            <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5B2A86]/30 resize-none"
              style={{ border: `1.5px solid ${C.border}` }} placeholder="Notes" rows={2} />
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={!editName.trim() || editSaving}
                className="flex-1 py-2 rounded-lg text-sm font-bold disabled:opacity-40"
                style={{ background: C.primary, color: '#fff' }}>
                {editSaving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setEditName(client.name); setEditPhone(client.phone || ''); setEditNotes(client.notes || '') }}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.muted }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-black" style={{ color: C.fg }}>{client.name}</h2>
              {client.phone && (
                <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 mt-1 text-sm font-semibold" style={{ color: C.primary }}>
                  <Phone size={13} /> {client.phone}
                </a>
              )}
              {client.notes && (
                <p className="mt-1 text-[12px]" style={{ color: C.muted }}>{client.notes}</p>
              )}
            </div>
            <button onClick={() => setEditing(true)} className="p-2 rounded-lg" style={{ background: C.primaryLight }}>
              <Edit2 size={14} style={{ color: C.primary }} />
            </button>
          </div>
        )}
      </div>

      {/* Balance card */}
      <div className="rounded-xl p-4 text-center" style={{ background: totalOwed > 0 ? C.dangerLight : C.successLight }}>
        <div className="text-[10px] font-black uppercase tracking-wider mb-1"
          style={{ color: totalOwed > 0 ? C.danger : C.success }}>
          {totalOwed > 0 ? 'Total Balance Owed' : 'All Clear'}
        </div>
        <div className="text-2xl font-black tabnum" style={{ color: totalOwed > 0 ? C.danger : C.success }}>
          KES {fmt(totalOwed)}
        </div>
        {pendingCredits.length > 0 && (
          <div className="text-[11px] font-semibold mt-1" style={{ color: C.muted }}>
            {pendingCredits.length} pending credit{pendingCredits.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* New Sale button */}
      <button
        onClick={() => router.push(`/sell?client=${client.id}`)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition active:scale-[0.98]"
        style={{ background: C.primary, color: '#fff' }}
      >
        <ShoppingCart size={15} /> New Sale for {client.name}
      </button>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('credits')}
          className="flex-1 py-2 rounded-lg text-[12px] font-bold transition"
          style={{
            background: tab === 'credits' ? C.primaryLight : C.surface,
            color: tab === 'credits' ? C.primary : C.muted,
            border: `1.5px solid ${tab === 'credits' ? C.primary : C.border}`,
          }}>
          Credits ({credits.length})
        </button>
        <button onClick={() => setTab('sales')}
          className="flex-1 py-2 rounded-lg text-[12px] font-bold transition"
          style={{
            background: tab === 'sales' ? C.primaryLight : C.surface,
            color: tab === 'sales' ? C.primary : C.muted,
            border: `1.5px solid ${tab === 'sales' ? C.primary : C.border}`,
          }}>
          Sales ({sales.length})
        </button>
      </div>

      {/* Credits tab */}
      {tab === 'credits' && (
        <div className="space-y-2">
          {pendingCredits.length === 0 && settledCredits.length === 0 && (
            <div className="text-center py-8" style={{ color: C.muted }}>
              <p className="text-sm">No credit history</p>
            </div>
          )}

          {pendingCredits.map(c => {
            const owed = Number(c.amount) - Number(c.paid)
            return (
              <div key={c.id} className="rounded-xl p-3" style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-semibold" style={{ color: C.muted }}>{fmtDate(c.created_at)}</div>
                    <div className="text-sm font-bold tabnum" style={{ color: C.fg }}>
                      Total: KES {fmt(Number(c.amount))}
                    </div>
                    {Number(c.paid) > 0 && (
                      <div className="text-[11px] font-semibold" style={{ color: C.success }}>
                        Paid: KES {fmt(Number(c.paid))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-black tabnum" style={{ color: C.danger }}>-{fmt(owed)}</div>
                    <div className="text-[10px] font-bold" style={{ color: C.danger }}>owed</div>
                  </div>
                </div>

                {payingId !== c.id && (
                  <button onClick={() => { setPayingId(c.id); setPayAmount(String(owed)) }}
                    className="mt-2 w-full py-2 rounded-lg text-[12px] font-bold transition active:scale-95"
                    style={{ background: C.success, color: '#fff' }}>
                    Record Payment
                  </button>
                )}

                {payingId === c.id && (
                  <div className="mt-3 space-y-2 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                    <input type="number" placeholder="Amount paid" value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5B2A86]/30"
                      style={{ background: C.bg, border: `1.5px solid ${C.border}` }} />
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setPayMethod('cash')}
                        className="py-2 rounded-lg text-sm font-bold"
                        style={{
                          background: payMethod === 'cash' ? C.primary : C.surface,
                          color: payMethod === 'cash' ? '#fff' : C.muted,
                          border: `1.5px solid ${payMethod === 'cash' ? C.primary : C.border}`,
                        }}>Cash</button>
                      <button onClick={() => setPayMethod('mpesa')}
                        className="py-2 rounded-lg text-sm font-bold"
                        style={{
                          background: payMethod === 'mpesa' ? C.primary : C.surface,
                          color: payMethod === 'mpesa' ? '#fff' : C.muted,
                          border: `1.5px solid ${payMethod === 'mpesa' ? C.primary : C.border}`,
                        }}>M-Pesa</button>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handlePayment(c)} disabled={payProcessing}
                        className="flex-1 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
                        style={{ background: C.success, color: '#fff' }}>
                        {payProcessing ? 'Saving...' : 'Confirm'}
                      </button>
                      <button onClick={() => setPayingId(null)} disabled={payProcessing}
                        className="px-4 py-2.5 rounded-lg text-sm"
                        style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.muted }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {settledCredits.length > 0 && (
            <>
              <div className="text-[10px] font-black uppercase tracking-wider pt-2" style={{ color: C.muted }}>
                Settled ({settledCredits.length})
              </div>
              {settledCredits.map(c => (
                <div key={c.id} className="rounded-xl p-3" style={{ background: C.surface, border: `1px solid ${C.border}`, opacity: 0.7 }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[12px] font-semibold" style={{ color: C.muted }}>{fmtDate(c.created_at)}</div>
                      <div className="text-sm font-bold tabnum" style={{ color: C.fg }}>KES {fmt(Number(c.amount))}</div>
                    </div>
                    <div className="flex items-center gap-1 text-[12px] font-bold" style={{ color: C.success }}>
                      <Check size={13} /> Settled
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Sales tab */}
      {tab === 'sales' && (
        <div className="space-y-2">
          {sales.length === 0 ? (
            <div className="text-center py-8" style={{ color: C.muted }}>
              <p className="text-sm">No sales yet</p>
            </div>
          ) : sales.map(s => {
            const bal = Number(s.total) - Number(s.paid_amount)
            const methodLabel = s.method === 'cash' ? 'Cash' : s.method === 'mpesa' ? 'M-Pesa' : s.method === 'split' ? 'Split' : ''
            return (
              <button
                key={s.id}
                onClick={() => router.push(`/sales/${s.id}/receipt`)}
                className="w-full text-left rounded-xl p-3 transition active:scale-[0.98]"
                style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-semibold" style={{ color: C.muted }}>
                      {fmtDate(s.created_at)} {fmtTime(s.created_at)}
                    </div>
                    <div className="text-sm font-bold tabnum" style={{ color: C.fg }}>
                      KES {fmt(Number(s.total))}
                    </div>
                    {methodLabel && (
                      <div className="text-[11px] font-semibold" style={{ color: C.muted }}>{methodLabel}</div>
                    )}
                  </div>
                  <div className="text-right">
                    {bal > 0 ? (
                      <div className="px-2 py-1 rounded-lg" style={{ background: C.dangerLight }}>
                        <div className="text-[11px] font-bold tabnum" style={{ color: C.danger }}>-{fmt(bal)}</div>
                      </div>
                    ) : (
                      <div className="px-2 py-1 rounded-lg" style={{ background: C.successLight }}>
                        <div className="text-[11px] font-bold" style={{ color: C.success }}>Paid</div>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
