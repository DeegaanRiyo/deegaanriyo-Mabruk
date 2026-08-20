# Mabruk POS — Offline Support Progress

## Status: Phase 1 COMPLETE (20 Aug 2026)

Single-device offline support for the Mabruk POS system. The app now works as a PWA, caches products locally, queues sales when offline, and auto-syncs when back online.

---

## Architecture

```
Browser
  |
  |-- Service Worker (public/sw.js)
  |     |-- Caches app shell (HTML/JS/CSS) for instant loads
  |     |-- Network-first for pages, cache-first for static assets
  |     |-- Supabase API calls are never cached (data must be fresh)
  |
  |-- IndexedDB (via idb-keyval)
  |     |-- mabruk_products     → Full product catalog cache
  |     |-- mabruk_products_ts  → Timestamp of last cache
  |     |-- mabruk_sale_*       → Queued offline sales
  |
  |-- ConnectionProvider (src/lib/connection.tsx)
  |     |-- Tracks online/offline status
  |     |-- Auto-flushes sale queue when back online
  |     |-- Shows toast notifications on sync
  |
  |-- TopBar status indicator
        |-- Green "Live" = online, no queued sales
        |-- Red "Offline" = no connection
        |-- Orange badge = queued sales count
        |-- Spinner "Syncing" = flushing queue
```

---

## Files Created/Modified

### New files
| File | Purpose |
|------|---------|
| `public/sw.js` | Service worker — caches app shell, handles offline fallback |
| `src/lib/offline.ts` | IndexedDB helpers: product cache, sale queue, connection utils, SW registration |
| `src/lib/sync.ts` | Sync engine — flushes queued sales to Supabase in order |
| `src/lib/connection.tsx` | React context provider for connection state + auto-sync |

### Modified files
| File | Change |
|------|--------|
| `src/app/(dashboard)/layout.tsx` | Added `ConnectionProvider` wrapper |
| `src/components/TopBar.tsx` | Replaced hardcoded "Live" with real connection status indicator |
| `src/app/(dashboard)/sell/page.tsx` | Products load from cache when offline; sales queue locally when offline |
| `public/site.webmanifest` | Updated start_url to `/sell`, added maskable icons, orientation |

### Dependencies added
| Package | Purpose |
|---------|---------|
| `idb-keyval` | Tiny IndexedDB wrapper (1KB) for product cache and sale queue |

---

## How It Works

### Product caching
1. On first successful product load (sell page), all products are saved to IndexedDB
2. When offline, the sell page reads products from IndexedDB instead of Supabase
3. Search works offline using local string matching (name, brand, size, code)
4. Cache updates every time you open the sell page while online

### Offline sales
1. When offline, clicking "Complete Sale" saves the sale to IndexedDB queue
2. The TopBar shows an orange badge with the count of queued sales
3. When connection returns, the ConnectionProvider auto-flushes the queue
4. Sales are synced in chronological order (FIFO)
5. A toast notification shows how many sales were synced
6. Failed syncs stay in queue for the next retry

### Service worker caching
- **App pages** (HTML): Network-first, fall back to cache
- **Static assets** (_next/ JS/CSS): Cache-first (immutable)
- **Fonts, images**: Cache-first after first load
- **Supabase API**: Always network (never cached)
- **Cache version**: `mabruk-v1` (bump this in sw.js to force refresh)

---

## What's NOT Covered Yet (Future Phases)

### Phase 2 — Stock deduction offline
- Currently offline sales don't deduct stock_qty locally
- The cached product list may show stale stock counts
- Fix: subtract sold quantities from cached products after each offline sale

### Phase 3 — Offline receipt viewing
- After an offline sale, the user gets an alert instead of a receipt
- Fix: generate a local receipt page for queued sales

### Phase 4 — Background sync API
- Replace manual online/offline polling with the Background Sync API
- More reliable: sync happens even if user closes the tab

### Phase 5 — Periodic product refresh
- Currently products are only cached when the sell page loads
- Fix: periodically refresh the cache (e.g., every 30 minutes)

---

## Testing Offline

1. Open the app in Chrome
2. Open DevTools → Application → Service Workers → verify registered
3. Check "Offline" in DevTools → Network tab
4. Navigate to `/sell` — products should load from cache
5. Make a sale → should show "Sale saved offline" alert
6. Uncheck "Offline" → TopBar should show "Syncing..." then "Live"
7. Check Supabase — the sale should be there

## Gotchas

- **First visit must be online** — the service worker needs one online load to cache everything
- **New deploys** — bump `CACHE_NAME` in `public/sw.js` to `mabruk-v2` etc. to force clients to refresh
- **Stock accuracy** — offline stock counts may be stale. Stock deduction happens on Supabase via triggers, so it's correct once synced
- **Credit sales offline** — credit records are queued alongside the sale and synced together
