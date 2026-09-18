/**
 * Sync engine — flushes queued offline sales to Supabase when back online
 *
 * Idempotency strategy:
 *   Each queue entry embeds its own `id` into the sale's `notes` field as
 *   `[sync:UUID]` on insert.  Before inserting, we look for an existing sale
 *   with that marker.  This means any failure after the sale insert (items,
 *   client, or credit) leaves a retry path that is safe to re-run without
 *   creating a duplicate transaction.
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
        // ── 1. Upsert sale (idempotent) ──────────────────────────────────────
        // Check if this queue entry was already synced in a previous attempt
        // (e.g., items or credit failed last time — sale is already in the DB).
        const syncMarker = `[sync:${q.id}]`
        const { data: existingSale } = await supabase
          .from('sales')
          .select('id')
          .like('notes', `%${syncMarker}%`)
          .maybeSingle()

        let saleId: string

        if (existingSale) {
          // Sale already in DB — resume from wherever the last attempt stopped.
          saleId = existingSale.id
        } else {
          // First attempt — insert and embed the sync marker so retries skip this step.
          const { data: sale, error: saleErr } = await supabase
            .from('sales')
            .insert({ ...q.sale, notes: syncMarker })
            .select('id')
            .single()

          if (saleErr || !sale) {
            result.failed++
            result.errors.push(`Sale ${q.id}: ${saleErr?.message ?? 'no data'}`)
            continue
          }
          saleId = sale.id
        }

        // ── 2. Insert sale items (idempotent) ─────────────────────────────────
        // Skip if items were already written on a previous attempt.
        const { count: existingItemCount } = await supabase
          .from('sale_items')
          .select('*', { count: 'exact', head: true })
          .eq('sale_id', saleId)

        if ((existingItemCount ?? 0) === 0) {
          const { error: itemsErr } = await supabase
            .from('sale_items')
            .insert(q.items.map(item => ({ ...item, sale_id: saleId })))

          if (itemsErr) {
            // Items failed. If we just created the sale, delete it so the next
            // retry does a clean insert (the sync marker won't be in the DB).
            if (!existingSale) {
              await supabase.from('sales').delete().eq('id', saleId)
            }
            result.failed++
            result.errors.push(`Items ${q.id}: ${itemsErr.message}`)
            continue
          }
        }

        // ── 3. Resolve or create client if needed ─────────────────────────────
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
            await supabase.from('sales').update({ client_id: resolvedClientId }).eq('id', saleId)
          }
        }

        // ── 4. Insert credit if applicable (idempotent) ───────────────────────
        if (q.credit) {
          // Skip if credit was already written on a previous attempt.
          const { data: existingCredit } = await supabase
            .from('credits')
            .select('id')
            .eq('sale_id', saleId)
            .maybeSingle()

          if (!existingCredit) {
            const { error: creditErr } = await supabase.from('credits').insert({
              sale_id: saleId,
              client_id: resolvedClientId,
              ...q.credit,
            })
            if (creditErr) {
              // Sale + items committed. Leave queue so the credit is retried next time.
              // The idempotency checks above mean the retry will skip sale+items safely.
              result.failed++
              result.errors.push(`Credit ${q.id}: ${creditErr.message}`)
              continue
            }
          }
        }

        // ── Success — remove from queue ───────────────────────────────────────
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
