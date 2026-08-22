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

        // 3. Resolve or create client if needed
        let resolvedClientId = q.sale.client_id
        if (!resolvedClientId && q.sale.client_name?.trim()) {
          const { data: existing } = await supabase
            .from('clients')
            .select('id')
            .ilike('name', q.sale.client_name.trim())
            .limit(1)
            .single()

          if (existing) {
            resolvedClientId = existing.id
          } else {
            const { data: newClient } = await supabase
              .from('clients')
              .insert({ name: q.sale.client_name.trim(), phone: q.sale.client_phone })
              .select('id')
              .single()
            resolvedClientId = newClient?.id ?? null
          }

          if (resolvedClientId) {
            await supabase.from('sales').update({ client_id: resolvedClientId }).eq('id', sale.id)
          }
        }

        // 4. Insert credit if applicable
        if (q.credit) {
          await supabase.from('credits').insert({
            sale_id: sale.id,
            client_id: resolvedClientId,
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
