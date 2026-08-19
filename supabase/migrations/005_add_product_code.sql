-- ============================================================
-- Migration 005: Add product code (SKU / supplier code)
-- Ensures consistency between PDF receipt parsing and manual entry
-- ============================================================

-- Add code column to products (supplier SKU / barcode)
ALTER TABLE products ADD COLUMN code TEXT;

-- Index for fast lookups by code
CREATE INDEX idx_products_code ON products(code);

-- Backfill: copy supplier_code from purchase_order_items to products
-- where we have a match and product doesn't already have a code
UPDATE products p
SET code = poi.supplier_code
FROM purchase_order_items poi
WHERE poi.product_id = p.id
  AND poi.supplier_code IS NOT NULL
  AND p.code IS NULL;
