'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const emailRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

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
      style={{ background: 'linear-gradient(160deg, #F7F4FA 0%, #EDE4F5 40%, #FAF8FB 100%)' }}
    >
      <div className="w-full max-w-sm mx-4">
        {/* Card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: '#fff',
            boxShadow: '0 8px 40px rgba(91,42,134,0.10), 0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {/* Logo section */}
          <div
            className="flex flex-col items-center pt-8 pb-5"
            style={{ background: '#FDFCFE' }}
          >
            <Image
              src="/logo.png"
              alt="Mabruk General Food Store"
              width={200}
              height={120}
              priority
              style={{ objectFit: 'contain' }}
            />
            <div
              className="mt-3"
              style={{
                fontSize: 11,
                color: '#6B6373',
                letterSpacing: '2.5px',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              Eastleigh &middot; Nairobi
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #E8E3ED, transparent)' }} />

          {/* Form */}
          <form onSubmit={handleLogin} className="px-7 pt-6 pb-7 space-y-5">
            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: '#5B2A86', letterSpacing: 0.5 }}>
                Email Address
              </label>
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-xl border-2 text-sm focus:outline-none transition-all"
                style={{
                  borderColor: email ? '#5B2A86' : '#E8E3ED',
                  background: '#FAFAFE',
                  color: '#1E1626',
                  fontWeight: 500,
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: '#5B2A86', letterSpacing: 0.5 }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 text-sm focus:outline-none transition-all pr-12"
                  style={{
                    borderColor: password ? '#5B2A86' : '#E8E3ED',
                    background: '#FAFAFE',
                    color: '#1E1626',
                    fontWeight: 500,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8DA8', fontSize: 12, fontWeight: 700 }}
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="text-xs font-semibold text-center py-2.5 rounded-xl"
                style={{ background: '#FDE8E8', color: '#C53030', border: '1px solid #FECACA' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3.5 rounded-xl text-sm font-bold disabled:opacity-40 active:scale-[0.98] transition-all"
              style={{
                background: 'linear-gradient(135deg, #5B2A86, #7B3DB0)',
                color: '#fff',
                fontSize: 14,
                letterSpacing: 0.5,
                boxShadow: '0 4px 14px rgba(91,42,134,0.25)',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Footer below card */}
        <div className="text-center mt-5" style={{ fontSize: 11, color: '#9B8DA8' }}>
          Contact the owner if you need an account
        </div>
      </div>
    </div>
  )
}
