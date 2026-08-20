'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { isOnline, onConnectionChange, getQueuedCount, registerSW } from './offline'
import { flushSaleQueue } from './sync'

interface ConnectionState {
  online: boolean
  queuedSales: number
  syncing: boolean
  refreshQueue: () => Promise<void>
}

const ConnectionContext = createContext<ConnectionState>({
  online: true,
  queuedSales: 0,
  syncing: false,
  refreshQueue: async () => {},
})

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true)
  const [queuedSales, setQueuedSales] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const refreshQueue = useCallback(async () => {
    const count = await getQueuedCount()
    setQueuedSales(count)
  }, [])

  // Register service worker on mount
  useEffect(() => { registerSW() }, [])

  // Track connection status
  useEffect(() => {
    setOnline(isOnline())
    return onConnectionChange(async (nowOnline) => {
      setOnline(nowOnline)
      if (nowOnline) {
        // Auto-sync when back online
        const count = await getQueuedCount()
        if (count > 0) {
          setSyncing(true)
          const result = await flushSaleQueue()
          setSyncing(false)
          await refreshQueue()
          if (result.synced > 0) {
            setToast(`${result.synced} sale${result.synced > 1 ? 's' : ''} synced`)
            setTimeout(() => setToast(null), 4000)
          }
          if (result.failed > 0) {
            setToast(`${result.failed} sale${result.failed > 1 ? 's' : ''} failed to sync`)
            setTimeout(() => setToast(null), 6000)
          }
        }
      }
    })
  }, [refreshQueue])

  // Check queue on mount
  useEffect(() => { refreshQueue() }, [refreshQueue])

  return (
    <ConnectionContext.Provider value={{ online, queuedSales, syncing, refreshQueue }}>
      {children}

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg animate-in fade-in slide-in-from-top-2"
          style={{
            background: toast.includes('failed') ? '#B23A3A' : '#2E7D5B',
            color: '#fff',
          }}>
          {toast}
        </div>
      )}
    </ConnectionContext.Provider>
  )
}

export function useConnection() {
  return useContext(ConnectionContext)
}
