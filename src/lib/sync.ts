/**
 * Sync engine — flushes queued offline sales to Supabase when back online
 */

import { createClient } from './supabase/client'
import { getQueuedSales, removeQueuedSale, type QueuedSale } from './offline'

let syncing = false

export type SyncResult = {
  synced: number
  failed: number
  errors: string[]
}

export async function flushSaleQueue(): Promise<SyncResult> {
  if (syncing) return { synced: 0, failed: 0, errors: [] }
  syncing = true

  const result: SyncResult = { synced: 0, failed: 0, errors: [] }

  try {
    const queued = await getQueuedSales()
    if (queued.length === 0) return result

    const supabase = createClient()

    for (const q of queued) {
      try {
        // 1. Insert sale
        const { data: sale, error: saleErr } = await supabase
          .from('sales')
          .insert(q.sale)
          .select('id')
          .single()

        if (saleErr || !sale) {
          result.failed++
          result.errors.push(`Sale ${q.id}: ${saleErr?.message ?? 'no data'}`)
          continue
        }

        // 2. Insert sale items
        const { error: itemsErr } = await supabase
          .from('sale_items')
          .insert(q.items.map(item => ({ ...item, sale_id: sale.id })))

        if (itemsErr) {
          result.failed++
          result.errors.push(`Items ${q.id}: ${itemsErr.message}`)
          continue
        }

        // 3. Insert credit if applicable
        if (q.credit) {
          await supabase.from('credits').insert({
            sale_id: sale.id,
            ...q.credit,
          })
        }

        // Success — remove from queue
        await removeQueuedSale(q.id)
        result.synced++
      } catch (err) {
        result.failed++
        result.errors.push(`Sale ${q.id}: ${err instanceof Error ? err.message : 'unknown'}`)
      }
    }
  } finally {
    syncing = false
  }

  return result
}
