-- Refactor product columns: piece/box model replaces old pack model
-- Rename pack_qty → pieces_per_unit
ALTER TABLE products RENAME COLUMN pack_qty TO pieces_per_unit;

-- Add sell_price_piece (per-piece price when selling boxes)
ALTER TABLE products ADD COLUMN IF NOT EXISTS sell_price_piece numeric(10,2);

-- Add supplier_name
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_name text;

-- Update unit_type values: old values → 'piece' (default)
UPDATE products SET unit_type = 'piece' WHERE unit_type NOT IN ('piece', 'box');

-- Set default for unit_type
ALTER TABLE products ALTER COLUMN unit_type SET DEFAULT 'piece';

-- Drop pack_cost (no longer needed — buy_price stores per-piece cost)
ALTER TABLE products DROP COLUMN IF EXISTS pack_cost;
