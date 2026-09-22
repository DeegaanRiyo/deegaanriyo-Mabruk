-- Fix KG products that can't sell fractionally because ppu is wrong,
-- fix size formats so isWeightProduct regex matches,
-- and NULL out clearly wrong sell_price_piece values from seed data.

BEGIN;

-- ─── 1. Fix Sugar/bulk bags: ppu must match KG number ──────────────────────

-- SUGAR 50KG: ppu=1 → ppu=50
UPDATE products
SET pieces_per_unit = 50,
    sell_price_piece = CASE WHEN sell_price > 0 THEN ROUND(sell_price / 50, 2) ELSE NULL END
WHERE UPPER(name) = 'SUGAR'
  AND UPPER(size) = '50KG'
  AND pieces_per_unit = 1;

-- BROWN SUGAR 50KG: ppu=1 → ppu=50
UPDATE products
SET pieces_per_unit = 50,
    sell_price_piece = CASE WHEN sell_price > 0 THEN ROUND(sell_price / 50, 2) ELSE NULL END
WHERE UPPER(name) = 'BROWN SUGAR'
  AND UPPER(size) = '50KG'
  AND pieces_per_unit = 1;

-- PISHORI 25KG: ppu=1 → ppu=25
UPDATE products
SET pieces_per_unit = 25,
    sell_price_piece = CASE WHEN sell_price > 0 THEN ROUND(sell_price / 25, 2) ELSE NULL END
WHERE UPPER(name) = 'PISHORI'
  AND UPPER(size) = '25KG'
  AND pieces_per_unit = 1;

-- ─── 2. Fix size formats so isWeightProduct regex matches ──────────────────

-- MUNIR RICE: "25KGS (BG)" → "25KG"
UPDATE products
SET size = '25KG'
WHERE UPPER(name) = 'MUNIR RICE'
  AND UPPER(size) LIKE '25KG%';

-- YABAL RICE: "25KG (BG)" → "25KG"
UPDATE products
SET size = '25KG'
WHERE UPPER(name) = 'YABAL RICE'
  AND UPPER(size) LIKE '25KG%';

-- ─── 3. NULL out clearly wrong sell_price_piece ────────────────────────────
-- These came from seed data dividing a low unitCost by a high ppu.
-- Setting to NULL forces user to enter real per-piece sell prices.

UPDATE products
SET sell_price_piece = NULL
WHERE sell_price_piece IS NOT NULL
  AND sell_price_piece <= 5
  AND pieces_per_unit > 10;

COMMIT;
