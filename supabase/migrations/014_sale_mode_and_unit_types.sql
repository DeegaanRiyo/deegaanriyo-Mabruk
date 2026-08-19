-- ============================================================
-- Migration 014: sale_items sell_mode + sell_qty columns
-- Records HOW items were sold (unit vs piece) and the original
-- cashier quantity, separate from the stock-deduction quantity.
-- ============================================================

-- sell_mode: 'unit' (full carton/bale/bag) or 'piece' (individual pc/KG)
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS sell_mode TEXT NOT NULL DEFAULT 'piece';

-- sell_qty: the number the cashier entered (1 carton, 0.5 carton, 2.5 KG)
-- NULL for legacy rows — receipt falls back to quantity column
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS sell_qty NUMERIC(10,2);
