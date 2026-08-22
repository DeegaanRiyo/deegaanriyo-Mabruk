/**
 * Offline support for Mabruk POS
 *
 * - Caches products in IndexedDB for offline sell page
 * - Queues sales when offline, syncs when back online
 * - Single device — no conflict resolution needed
 */

import { get, set, del, keys } from 'idb-keyval'
import type { Product, Client } from './types'

// ── Keys ────────────────────────────────────────────────────────────────────
const PRODUCTS_KEY = 'mabruk_products'
const PRODUCTS_TS_KEY = 'mabruk_products_ts'
const CLIENTS_KEY = 'mabruk_clients'
const CLIENTS_TS_KEY = 'mabruk_clients_ts'
const SALE_QUEUE_PREFIX = 'mabruk_sale_'

// ── Product cache ───────────────────────────────────────────────────────────

export async function cacheProducts(products: Product[]) {
  await set(PRODUCTS_KEY, products)
  await set(PRODUCTS_TS_KEY, Date.now())
}

export async function getCachedProducts(): Promise<Product[] | null> {
  return (await get<Product[]>(PRODUCTS_KEY)) ?? null
}

export async function getCacheAge(): Promise<number | null> {
  const ts = await get<number>(PRODUCTS_TS_KEY)
  return ts ? Date.now() - ts : null
}

// ── Client cache ───────────────────────────────────────────────────────────

export async function cacheClients(clients: Client[]) {
  await set(CLIENTS_KEY, clients)
  await set(CLIENTS_TS_KEY, Date.now())
}

export async function getCachedClients(): Promise<Client[] | null> {
  return (await get<Client[]>(CLIENTS_KEY)) ?? null
}

// ── Offline sale queue ──────────────────────────────────────────────────────

export interface QueuedSale {
  id: string            // temporary local ID
  timestamp: number
  sale: {
    total: number
    paid_amount: number
    method: string
    cash_amount: number
    mpesa_amount: number
    mpesa_ref: string | null
    client_id: string | null
    client_name: string | null
    client_phone: string | null
  }
  items: {
    product_id: string
    quantity: number
    sell_mode: string
    sell_qty: number
    unit_price: number
    buy_price: number
    line_total: number
  }[]
  credit: {
    client_name: string
    client_phone: string | null
    amount: number
    paid: number
  } | null
}

export async function queueSale(sale: QueuedSale) {
  await set(SALE_QUEUE_PREFIX + sale.id, sale)
}

export async function getQueuedSales(): Promise<QueuedSale[]> {
  const allKeys = await keys()
  const saleKeys = allKeys.filter(k => String(k).startsWith(SALE_QUEUE_PREFIX))
  const sales: QueuedSale[] = []
  for (const key of saleKeys) {
    const sale = await get<QueuedSale>(key)
    if (sale) sales.push(sale)
  }
  return sales.sort((a, b) => a.timestamp - b.timestamp)
}

export async function removeQueuedSale(id: string) {
  await del(SALE_QUEUE_PREFIX + id)
}

export async function getQueuedCount(): Promise<number> {
  const allKeys = await keys()
  return allKeys.filter(k => String(k).startsWith(SALE_QUEUE_PREFIX)).length
}

// ── Connection status ───────────────────────────────────────────────────────

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

export function onConnectionChange(cb: (online: boolean) => void): () => void {
  const onOnline = () => cb(true)
  const onOffline = () => cb(false)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}

// ── Service worker registration ─────────────────────────────────────────────

export async function registerSW() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing
      if (!newWorker) return
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          // New SW activated — could show a "refresh" toast
          console.log('[SW] Updated and activated')
        }
      })
    })
    console.log('[SW] Registered')
  } catch (err) {
    console.error('[SW] Registration failed:', err)
  }
}
