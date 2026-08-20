'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Credit } from '@/lib/types'
import { fmt, fmtDate } from '@/lib/utils'
import { Users, Check } from 'lucide-react'

export default function CreditsPage() {
  const supabase = createClient()
  const [credits, setCredits] = useState<Credit[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'settled'>('pending')
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<'cash' | 'mpesa'>('cash')
  const [payProcessing, setPayProcessing] = useState(false)
  const [dateRange, setDateRange] = useState<'all' | 'week' | 'month'>('all')

  useEffect(() => { loadCredits() }, [filter, dateRange]) // eslint-disable-line

  async function loadCredits() {
    setLoading(true)
    let q = supabase
      .from('credits')
      .select('*')
      .eq('is_settled', filter === 'settled')
      .order('created_at', { ascending: false })

    if (dateRange !== 'all') {
      const cutoff = new Date()
      if (dateRange === 'week') cutoff.setDate(cutoff.getDate() - 7)
      else cutoff.setMonth(cutoff.getMonth() - 1)
      q = q.gte('created_at', cutoff.toISOString())
    }

    const { data } = await q
    setCredits((data ?? []) as Credit[])
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
    if (error) {
      alert('Payment failed: ' + error.message)
      return
    }

    setPayingId(null)
    setPayAmount('')
    loadCredits()
  }

  const totalOwed = credits.reduce((s, c) => s + (Number(c.amount) - Number(c.paid)), 0)

  return (
    <div className="p-4 space-y-4">
      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('pending')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition active:scale-95 flex-shrink-0"
          style={{
            background: filter === 'pending' ? '#EDE4F5' : '#fff',
            color: filter === 'pending' ? '#5B2A86' : '#6B6373',
            border: `1.5px solid ${filter === 'pending' ? '#5B2A86' : '#E8E3ED'}`,
          }}
        >
          Pending
        </button>
        <button
          onClick={() => setFilter('settled')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition active:scale-95 flex-shrink-0"
          style={{
            background: filter === 'settled' ? '#EDE4F5' : '#fff',
            color: filter === 'settled' ? '#5B2A86' : '#6B6373',
            border: `1.5px solid ${filter === 'settled' ? '#5B2A86' : '#E8E3ED'}`,
          }}
        >
          Settled
        </button>

        <div style={{ width: 1, background: '#E8E3ED', margin: '0 2px' }} />

        {(['all', 'week', 'month'] as const).map(d => (
          <button
            key={d}
            onClick={() => setDateRange(d)}
            className="px-3 py-1.5 rounded-lg text-[12px] font-bold transition active:scale-95 flex-shrink-0"
            style={{
              background: dateRange === d ? '#F1F3F5' : '#fff',
              color: dateRange === d ? '#374151' : '#6B6373',
              border: `1.5px solid ${dateRange === d ? '#9CA3AF' : '#E8E3ED'}`,
            }}
          >
            {d === 'all' ? 'All time' : d === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
      </div>

      {/* Summary */}
      {filter === 'pending' && credits.length > 0 && (
        <div className="bg-warning-light rounded-xl p-4 text-center" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="text-xs text-warning font-medium mb-1">TOTAL OWED TO YOU</div>
          <div className="text-2xl font-bold tabnum text-warning">KES {fmt(totalOwed)}</div>
          <div className="text-xs text-muted mt-1">{credits.length} people</div>
        </div>
      )}

      {/* Credits list */}
      {loading ? (
        <div className="p-6"><div className="animate-pulse space-y-3"><div className="h-10 bg-border/50 rounded-xl" /><div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-border/50 rounded-xl" />)}</div></div></div>
      ) : credits.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{filter === 'pending' ? 'No pending credits' : 'No settled credits'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {credits.map(c => {
            const owed = Number(c.amount) - Number(c.paid)
            return (
              <div key={c.id} className="bg-white rounded-xl p-3" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm">{c.client_name}</div>
                    <div className="text-xs text-muted">
                      {fmtDate(c.created_at)}
                      {c.client_phone && ` · ${c.client_phone}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm tabnum">KES {fmt(Number(c.amount))}</div>
                    {c.is_settled ? (
                      <div className="flex items-center gap-1 text-success text-xs font-bold"><Check size={12} /> Settled</div>
                    ) : (
                      <div className="text-danger text-xs font-bold">-{fmt(owed)} owed</div>
                    )}
                  </div>
                </div>

                {!c.is_settled && payingId !== c.id && (
                  <button
                    onClick={() => { setPayingId(c.id); setPayAmount(String(owed)) }}
                    className="mt-2 w-full bg-success text-white rounded-lg py-2 text-sm font-bold"
                  >
                    Record Payment
                  </button>
                )}

                {payingId === c.id && (
                  <div className="mt-3 space-y-2 border-t border-[#E8E3ED] pt-3">
                    <input
                      type="number"
                      placeholder="Amount paid"
                      value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#FAF8FB] border-[1.5px] border-[#E8E3ED] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setPayMethod('cash')}
                        className={`py-2 rounded-lg text-sm font-bold border ${payMethod === 'cash' ? 'bg-primary text-white border-primary' : 'bg-white border-[#E8E3ED]'}`}
                      >
                        Cash
                      </button>
                      <button
                        onClick={() => setPayMethod('mpesa')}
                        className={`py-2 rounded-lg text-sm font-bold border ${payMethod === 'mpesa' ? 'bg-primary text-white border-primary' : 'bg-white border-[#E8E3ED]'}`}
                      >
                        M-Pesa
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePayment(c)}
                        disabled={payProcessing}
                        className="flex-1 bg-success text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
                      >
                        {payProcessing ? 'Saving...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setPayingId(null)}
                        disabled={payProcessing}
                        className="px-4 bg-background border border-border rounded-lg py-2.5 text-sm text-muted disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
