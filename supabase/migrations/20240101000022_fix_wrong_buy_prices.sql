-- Fix products where buy_price was wrongly divided by ppu.
-- These products had unitCost = per-piece wholesale cost on the receipt,
-- but the seed code divided by ppu thinking it was per-carton/unit.
-- Detectable because: buy_price * ppu ≈ sell_price (within 1 KES)
-- AND buy_price < 6 (impossibly cheap per piece for these products).
--
-- Fix: restore buy_price to the real per-piece cost (= sell_price),
-- then reset sell_price/sell_price_piece so user sets real retail prices.

BEGIN;

UPDATE products
SET
  buy_price = sell_price,         -- sell_price IS the original per-piece unitCost
  sell_price = 0,                 -- reset — user must set real carton retail price
  sell_price_piece = NULL         -- reset — user must set real piece retail price
WHERE
  buy_price < 6                   -- per-piece cost is suspiciously low
  AND pieces_per_unit > 10        -- multi-unit product
  AND sell_price > 0              -- has a sell_price to restore from
  AND ABS(ROUND(buy_price * pieces_per_unit, 2) - sell_price) < 2;  -- confirms the pattern

COMMIT;
