'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ClientSummary } from '@/lib/types'
import { fmt, fmtDate } from '@/lib/utils'
import { Search, Users, Plus, Phone, X } from 'lucide-react'

const C = {
  bg: '#FAF8FB', surface: '#FFFFFF', fg: '#1E1626',
  primary: '#5B2A86', primaryLight: '#EDE4F5',
  muted: '#6B6373', border: '#E8E3ED',
  success: '#2E7D5B', successLight: '#E3F3EC',
  danger: '#B23A3A', dangerLight: '#FBE9E9',
  warning: '#B8791C', warningLight: '#FBF0DC',
}

export default function ClientsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadClients() }, []) // eslint-disable-line

  async function loadClients() {
    setLoading(true)
    const { data } = await supabase.rpc('get_client_summary')
    setClients((data ?? []) as ClientSummary[])
    setLoading(false)
  }

  async function addClient() {
    if (!newName.trim() || saving) return
    setSaving(true)
    const { error } = await supabase.from('clients').insert({
      name: newName.trim(),
      phone: newPhone.trim() || null,
    })
    setSaving(false)
    if (error) { alert('Failed: ' + error.message); return }
    setNewName('')
    setNewPhone('')
    setShowAdd(false)
    loadClients()
  }

  const q = search.trim().toLowerCase()
  const filtered = q
    ? clients.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
      )
    : clients

  const totalOwed = clients.reduce((s, c) => s + Number(c.total_owed), 0)
  const withDebt = clients.filter(c => Number(c.total_owed) > 0).length

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black" style={{ color: C.fg }}>Clients</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition active:scale-95"
          style={{ background: C.primary, color: '#fff' }}
        >
          <Plus size={13} /> Add
        </button>
      </div>

      {/* Summary */}
      {totalOwed > 0 && (
        <div className="rounded-xl p-4 text-center" style={{ background: C.warningLight }}>
          <div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: C.warning }}>
            Total Credit Owed
          </div>
          <div className="text-2xl font-black tabnum" style={{ color: C.warning }}>
            KES {fmt(totalOwed)}
          </div>
          <div className="text-[11px] font-semibold mt-1" style={{ color: C.muted }}>
            {withDebt} client{withDebt !== 1 ? 's' : ''} with balance
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5B2A86]/30"
          style={{ background: C.surface, border: `1.5px solid ${C.border}` }}
        />
      </div>

      {/* Client list */}
      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-xl" style={{ background: C.border }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12" style={{ color: C.muted }}>
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{search ? 'No clients match your search' : 'No clients yet'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const owed = Number(c.total_owed)
            return (
              <button
                key={c.id}
                onClick={() => router.push(`/clients/${c.id}`)}
                className="w-full text-left rounded-xl p-3 transition active:scale-[0.98]"
                style={{ background: C.surface, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: `1px solid ${C.border}` }}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[14px] truncate" style={{ color: C.fg }}>{c.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.phone && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: C.muted }}>
                          <Phone size={10} /> {c.phone}
                        </span>
                      )}
                      <span className="text-[11px] font-semibold" style={{ color: C.muted }}>
                        {Number(c.total_sales)} sale{Number(c.total_sales) !== 1 ? 's' : ''}
                      </span>
                      {c.last_sale && (
                        <span className="text-[11px] font-semibold" style={{ color: C.muted }}>
                          Last: {fmtDate(c.last_sale)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    {owed > 0 ? (
                      <div className="px-2.5 py-1 rounded-lg" style={{ background: C.dangerLight }}>
                        <div className="text-[10px] font-black uppercase" style={{ color: C.danger }}>Owes</div>
                        <div className="text-[14px] font-black tabnum" style={{ color: C.danger }}>
                          {fmt(owed)}
                        </div>
                      </div>
                    ) : (
                      <div className="px-2.5 py-1 rounded-lg" style={{ background: C.successLight }}>
                        <div className="text-[11px] font-bold" style={{ color: C.success }}>Clear</div>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Add client modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4" style={{ background: C.bg }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black" style={{ color: C.fg }}>New Client</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded-full" style={{ background: C.border }}>
                <X size={16} style={{ color: C.muted }} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                placeholder="Client name *"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5B2A86]/30"
                style={{ background: C.surface, border: `1.5px solid ${C.border}` }}
                autoFocus
              />
              <input
                placeholder="Phone (optional)"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5B2A86]/30"
                style={{ background: C.surface, border: `1.5px solid ${C.border}` }}
              />
              <button
                onClick={addClient}
                disabled={!newName.trim() || saving}
                className="w-full py-3 rounded-xl text-sm font-black disabled:opacity-40 transition active:scale-[0.98]"
                style={{ background: C.primary, color: '#fff' }}
              >
                {saving ? 'Saving...' : 'Add Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
