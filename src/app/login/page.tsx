'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const emailRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { emailRef.current?.focus() }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'Wrong email or password'
        : authError.message
      )
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: '#FAF8FB' }}
    >
      <div className="w-80 space-y-6">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div
            className="mx-auto flex items-center justify-center"
            style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#5B2A86', color: '#fff',
              fontSize: 30, fontWeight: 800,
              border: '3px solid #EDE4F5',
            }}
          >
            M
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1E1626' }}>
              Mabruk Store
            </div>
            <div style={{ fontSize: 11, color: '#6B6373', letterSpacing: '2px', textTransform: 'uppercase', marginTop: 2 }}>
              Eastleigh &middot; Nairobi
            </div>
          </div>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6373' }}>
              Email
            </label>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-3 py-2.5 rounded-xl border-2 text-sm focus:outline-none transition"
              style={{
                borderColor: '#E8E3ED',
                background: '#fff',
                color: '#1E1626',
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6373' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full px-3 py-2.5 rounded-xl border-2 text-sm focus:outline-none transition"
              style={{
                borderColor: '#E8E3ED',
                background: '#fff',
                color: '#1E1626',
              }}
            />
          </div>

          {error && (
            <div
              className="text-xs font-semibold text-center py-2 rounded-lg"
              style={{ background: '#FDE8E8', color: '#C53030' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-40 active:scale-95 transition"
            style={{ background: '#5B2A86', color: '#fff' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center" style={{ fontSize: 11, color: '#6B6373' }}>
          Contact the owner if you need an account
        </div>
      </div>
    </div>
  )
}
