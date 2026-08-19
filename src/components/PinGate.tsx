'use client'

import { useState, useEffect, useRef } from 'react'

const PIN = process.env.NEXT_PUBLIC_APP_PIN
const SESSION_KEY = 'mabruk_pin_ok'

export default function PinGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // No PIN configured — skip gate entirely
    if (!PIN) { setUnlocked(true); return }
    // Already unlocked this session
    if (sessionStorage.getItem(SESSION_KEY) === '1') { setUnlocked(true); return }
    // Focus the input
    inputRef.current?.focus()
  }, [])

  function submit() {
    if (input === PIN) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setUnlocked(true)
    } else {
      setError(true)
      setInput('')
      setTimeout(() => setError(false), 1200)
    }
  }

  if (unlocked) return <>{children}</>

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: '#FAF8FB' }}
    >
      <div className="w-72 text-center space-y-6">
        {/* Logo */}
        <div
          className="mx-auto flex items-center justify-center"
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--color-primary)', color: '#fff',
            fontSize: 30, fontWeight: 800,
            border: '3px solid var(--color-primary-light)',
          }}
        >
          M
        </div>

        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-foreground)' }}>
            Mabruk Store
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
            Enter PIN to continue
          </div>
        </div>

        {/* PIN input */}
        <div>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={input}
            onChange={e => setInput(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder="••••"
            className="w-full text-center text-2xl font-bold tracking-[0.3em] py-3 rounded-xl border-2 focus:outline-none transition"
            style={{
              borderColor: error ? 'var(--color-danger)' : 'var(--color-border)',
              background: error ? 'var(--color-danger-light)' : '#fff',
              color: 'var(--color-foreground)',
            }}
          />
          {error && (
            <div style={{ fontSize: 12, color: 'var(--color-danger)', fontWeight: 600, marginTop: 8 }}>
              Wrong PIN
            </div>
          )}
        </div>

        <button
          onClick={submit}
          disabled={input.length < 4}
          className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-40 active:scale-95 transition"
          style={{ background: 'var(--color-primary)', color: '#fff' }}
        >
          Unlock
        </button>
      </div>
    </div>
  )
}
