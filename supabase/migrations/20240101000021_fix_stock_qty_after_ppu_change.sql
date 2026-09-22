-- Fix stock_qty and buy_price for products whose ppu was changed from 1 to N.
-- When ppu was 1, stock_qty=1 meant "1 bag" and buy_price was "per bag".
-- Now with ppu=50, stock_qty=1 would mean "1 KG" — wrong.
-- Multiply stock_qty by new ppu, and divide buy_price by new ppu.

BEGIN;

-- SUGAR: ppu changed 1→50, stock_qty=1 (was 1 bag = 50 KG)
-- buy_price=12700 (was per bag, need per KG = 254)
UPDATE products
SET stock_qty = stock_qty * 50,
    buy_price = ROUND(buy_price / 50, 2),
    sell_price_piece = CASE WHEN buy_price > 0 THEN ROUND((buy_price / 50) * 1.1) ELSE NULL END
WHERE UPPER(name) = 'SUGAR'
  AND UPPER(size) = '50KG'
  AND pieces_per_unit = 50
  AND buy_price > 1000;  -- safety: only if buy_price looks like per-bag

-- BROWN SUGAR: ppu changed 1→50, stock_qty=1 (was 1 bag)
-- buy_price=6250 (per bag, need per KG = 125)
UPDATE products
SET stock_qty = stock_qty * 50,
    buy_price = ROUND(buy_price / 50, 2),
    sell_price_piece = CASE WHEN buy_price > 0 THEN ROUND((buy_price / 50) * 1.1) ELSE NULL END
WHERE UPPER(name) = 'BROWN SUGAR'
  AND UPPER(size) = '50KG'
  AND pieces_per_unit = 50
  AND buy_price > 1000;

-- PISHORI: ppu changed 1→25, stock_qty=1 (was 1 bag = 25 KG)
-- buy_price=3900 (per bag, need per KG = 156)
UPDATE products
SET stock_qty = stock_qty * 25,
    buy_price = ROUND(buy_price / 25, 2),
    sell_price_piece = CASE WHEN buy_price > 0 THEN ROUND((buy_price / 25) * 1.1) ELSE NULL END
WHERE UPPER(name) = 'PISHORI'
  AND UPPER(size) = '25KG'
  AND pieces_per_unit = 25
  AND buy_price > 1000;

-- MUNIR RICE and YABAL RICE: ppu was already correct (25), only size format
-- was fixed. But buy_price might be per-bag if they were added with ppu=1 originally.
-- MUNIR RICE: buy_price=86, ppu=25 — 86/KG seems reasonable, no fix needed
-- YABAL RICE: buy_price=51.33, ppu=25 — 51/KG seems reasonable, no fix needed

COMMIT;
