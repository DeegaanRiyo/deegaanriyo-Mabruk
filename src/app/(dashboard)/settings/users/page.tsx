'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, type Profile, type Role } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'
import { UserCircle, Plus, Shield, ShoppingCart, X, Check, AlertTriangle } from 'lucide-react'

const INP = 'w-full px-3 py-2.5 bg-white border-2 border-[#E8E3ED] rounded-xl text-sm text-[#1E1626] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#5B2A86] focus:ring-2 focus:ring-[#5B2A86]/20 transition'

export default function UserManagementPage() {
  const supabase = createClient()
  const router = useRouter()
  const { isOwner, loading: authLoading } = useAuth()

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  // New user form
  const [showForm, setShowForm] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('cashier')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Edit role
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<Role>('cashier')

  useEffect(() => {
    if (!authLoading && !isOwner) {
      router.replace('/sell')
      return
    }
    if (!authLoading && isOwner) loadProfiles()
  }, [authLoading, isOwner]) // eslint-disable-line

  async function loadProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
    setProfiles((data ?? []) as Profile[])
    setLoading(false)
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      // Call server-side API to create user (needs service role)
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          role,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create user')
        setSaving(false)
        return
      }

      setSuccess(`${fullName.trim()} created as ${role}`)
      setFullName('')
      setEmail('')
      setPassword('')
      setRole('cashier')
      setShowForm(false)
      await loadProfiles()
    } catch {
      setError('Network error')
    }
    setSaving(false)
  }

  async function handleUpdateRole(profileId: string, newRole: Role) {
    const { error: err } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', profileId)

    if (err) {
      setError(err.message)
    } else {
      setEditingId(null)
      await loadProfiles()
    }
  }

  async function handleToggleActive(profileId: string, currentlyActive: boolean) {
    const { error: err } = await supabase
      .from('profiles')
      .update({ is_active: !currentlyActive })
      .eq('id', profileId)

    if (err) {
      setError(err.message)
    } else {
      await loadProfiles()
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div style={{ fontSize: 13, color: '#6B6373' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1E1626' }}>
            User Management
          </h1>
          <p style={{ fontSize: 13, color: '#6B6373', marginTop: 2 }}>
            {profiles.length} user{profiles.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(''); setSuccess('') }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition"
          style={{ background: '#5B2A86', color: '#fff' }}
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {/* Success/Error banners */}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold"
          style={{ background: '#E3F3EC', color: '#2E7D5B' }}>
          <Check size={16} /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold"
          style={{ background: '#FDE8E8', color: '#C53030' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Create user form */}
      {showForm && (
        <form
          onSubmit={handleCreateUser}
          className="p-5 rounded-2xl space-y-4"
          style={{ background: '#fff', border: '1px solid #E8E3ED', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1E1626' }}>
            New User
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#6B6373' }}>Full Name</label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Ahmed Hassan"
                required
                className={INP}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#6B6373' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ahmed@example.com"
                required
                className={INP}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#6B6373' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
                minLength={6}
                className={INP}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#6B6373' }}>Role</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRole('cashier')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition"
                  style={{
                    borderColor: role === 'cashier' ? '#C9912B' : '#E8E3ED',
                    background: role === 'cashier' ? '#F7EBD3' : '#fff',
                    color: role === 'cashier' ? '#C9912B' : '#6B6373',
                  }}
                >
                  <ShoppingCart size={14} /> Cashier
                </button>
                <button
                  type="button"
                  onClick={() => setRole('owner')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition"
                  style={{
                    borderColor: role === 'owner' ? '#5B2A86' : '#E8E3ED',
                    background: role === 'owner' ? '#EDE4F5' : '#fff',
                    color: role === 'owner' ? '#5B2A86' : '#6B6373',
                  }}
                >
                  <Shield size={14} /> Owner
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{ background: '#FFF9EE', color: '#B8791C' }}>
            <AlertTriangle size={14} className="flex-shrink-0" />
            {role === 'cashier'
              ? 'Cashier can only record sales and view sales history'
              : 'Owner has full access to all features including finances and user management'
            }
          </div>

          <button
            type="submit"
            disabled={saving || !fullName.trim() || !email.trim() || password.length < 6}
            className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-40 active:scale-95 transition"
            style={{ background: '#5B2A86', color: '#fff' }}
          >
            {saving ? 'Creating...' : 'Create User'}
          </button>
        </form>
      )}

      {/* User list */}
      <div className="space-y-3">
        {profiles.map(p => (
          <div
            key={p.id}
            className="flex items-center gap-4 p-4 rounded-2xl"
            style={{
              background: '#fff',
              border: '1px solid #E8E3ED',
              opacity: p.is_active ? 1 : 0.5,
            }}
          >
            {/* Avatar */}
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: p.role === 'owner' ? '#5B2A86' : '#C9912B',
                color: '#fff', fontSize: 16, fontWeight: 700,
              }}
            >
              {(p.full_name || '?')[0].toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate" style={{ fontSize: 14, fontWeight: 600, color: '#1E1626' }}>
                  {p.full_name || 'Unnamed'}
                </span>
                {!p.is_active && (
                  <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: '#FDE8E8', color: '#C53030' }}>
                    Disabled
                  </span>
                )}
              </div>

              {/* Role badge or editor */}
              {editingId === p.id ? (
                <div className="flex items-center gap-2 mt-1">
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value as Role)}
                    className="text-xs px-2 py-1 rounded-lg border"
                    style={{ borderColor: '#E8E3ED' }}
                  >
                    <option value="cashier">Cashier</option>
                    <option value="owner">Owner</option>
                  </select>
                  <button
                    onClick={() => handleUpdateRole(p.id, editRole)}
                    className="text-xs font-bold px-2 py-1 rounded-lg"
                    style={{ background: '#E3F3EC', color: '#2E7D5B' }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ color: '#6B6373' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{
                      background: p.role === 'owner' ? '#EDE4F5' : '#F7EBD3',
                      color: p.role === 'owner' ? '#5B2A86' : '#C9912B',
                    }}
                  >
                    {p.role === 'owner' ? <Shield size={10} /> : <ShoppingCart size={10} />}
                    {p.role}
                  </span>
                  <button
                    onClick={() => { setEditingId(p.id); setEditRole(p.role) }}
                    className="text-xs underline"
                    style={{ color: '#6B6373' }}
                  >
                    change
                  </button>
                </div>
              )}
            </div>

            {/* Toggle active */}
            <button
              onClick={() => handleToggleActive(p.id, p.is_active)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              style={{
                background: p.is_active ? '#FDE8E8' : '#E3F3EC',
                color: p.is_active ? '#C53030' : '#2E7D5B',
              }}
            >
              {p.is_active ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
