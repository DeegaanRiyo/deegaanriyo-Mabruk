'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'
import { Check, AlertTriangle, User, Lock } from 'lucide-react'

const INP = 'w-full px-3 py-2.5 bg-white border-2 border-[#E8E3ED] rounded-xl text-sm text-[#1E1626] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#5B2A86] focus:ring-2 focus:ring-[#5B2A86]/20 transition'

export default function ProfilePage() {
  const supabase = createClient()
  const { user, profile, isOwner } = useAuth()

  // Profile fields
  const [fullName, setFullName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Password fields
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (profile) setFullName(profile.full_name)
  }, [profile])

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    setNameMsg(null)
    setSavingName(true)

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', user!.id)

    if (error) {
      setNameMsg({ type: 'err', text: error.message })
    } else {
      setNameMsg({ type: 'ok', text: 'Name updated' })
      setTimeout(() => setNameMsg(null), 3000)
    }
    setSavingName(false)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg(null)

    if (newPassword.length < 6) {
      setPwMsg({ type: 'err', text: 'Password must be at least 6 characters' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'err', text: 'Passwords do not match' })
      return
    }

    setSavingPw(true)

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setPwMsg({ type: 'err', text: error.message })
    } else {
      setPwMsg({ type: 'ok', text: 'Password changed' })
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPwMsg(null), 3000)
    }
    setSavingPw(false)
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div style={{ fontSize: 13, color: '#6B6373' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-24">
      {/* Header */}
      <div className="text-center space-y-3">
        <div
          className="mx-auto flex items-center justify-center"
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: isOwner ? '#5B2A86' : '#C9912B',
            color: '#fff', fontSize: 28, fontWeight: 800,
            border: '3px solid #EDE4F5',
          }}
        >
          {(profile.full_name || '?')[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1E1626' }}>
            {profile.full_name || 'User'}
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold"
              style={{
                background: isOwner ? '#EDE4F5' : '#F7EBD3',
                color: isOwner ? '#5B2A86' : '#C9912B',
              }}
            >
              {profile.role}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#6B6373', marginTop: 4 }}>
            {user?.email}
          </div>
        </div>
      </div>

      {/* Edit name */}
      <form
        onSubmit={handleSaveName}
        className="p-5 rounded-2xl space-y-4"
        style={{ background: '#fff', border: '1px solid #E8E3ED', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center gap-2" style={{ fontSize: 15, fontWeight: 700, color: '#1E1626' }}>
          <User size={16} /> Profile
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#6B6373' }}>Full Name</label>
          <input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Your name"
            required
            className={INP}
          />
        </div>

        {nameMsg && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{
              background: nameMsg.type === 'ok' ? '#E3F3EC' : '#FDE8E8',
              color: nameMsg.type === 'ok' ? '#2E7D5B' : '#C53030',
            }}
          >
            {nameMsg.type === 'ok' ? <Check size={14} /> : <AlertTriangle size={14} />}
            {nameMsg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={savingName || !fullName.trim() || fullName.trim() === profile.full_name}
          className="w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 active:scale-95 transition"
          style={{ background: '#5B2A86', color: '#fff' }}
        >
          {savingName ? 'Saving...' : 'Save Name'}
        </button>
      </form>

      {/* Change password */}
      <form
        onSubmit={handleChangePassword}
        className="p-5 rounded-2xl space-y-4"
        style={{ background: '#fff', border: '1px solid #E8E3ED', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center gap-2" style={{ fontSize: 15, fontWeight: 700, color: '#1E1626' }}>
          <Lock size={16} /> Change Password
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#6B6373' }}>New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Min 6 characters"
            required
            minLength={6}
            className={INP}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#6B6373' }}>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            required
            className={INP}
          />
        </div>

        {pwMsg && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{
              background: pwMsg.type === 'ok' ? '#E3F3EC' : '#FDE8E8',
              color: pwMsg.type === 'ok' ? '#2E7D5B' : '#C53030',
            }}
          >
            {pwMsg.type === 'ok' ? <Check size={14} /> : <AlertTriangle size={14} />}
            {pwMsg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={savingPw || !newPassword || !confirmPassword}
          className="w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 active:scale-95 transition"
          style={{ background: '#5B2A86', color: '#fff' }}
        >
          {savingPw ? 'Changing...' : 'Change Password'}
        </button>
      </form>
    </div>
  )
}
