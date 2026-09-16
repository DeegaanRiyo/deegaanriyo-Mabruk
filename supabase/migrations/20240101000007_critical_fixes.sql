-- ============================================================
-- Migration 007: Critical Fixes
-- 1. Fix sales.method CHECK to allow 'split'
-- 2. Add RPC for low-stock products (column-to-column comparison)
-- 3. Add missing indexes on purchase_orders and expenses
-- ============================================================

-- ── 1. Fix CHECK constraint on sales.method ──────────────────
-- The original constraint only allows 'cash' and 'mpesa'.
-- Migration 006 added split payment support but never updated
-- the constraint, so INSERT with method='split' fails with
-- check_violation (23514).

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_method_check
  CHECK (method IN ('cash', 'mpesa', 'split'));

-- ── 2. RPC: low-stock products (column-to-column compare) ───
-- PostgREST .filter('stock_qty','lte','min_stock') compares to
-- the literal string 'min_stock', not the column. This RPC does
-- the correct WHERE stock_qty <= min_stock comparison.

CREATE OR REPLACE FUNCTION get_low_stock_products()
RETURNS TABLE (
  name        TEXT,
  brand       TEXT,
  size        TEXT,
  stock_qty   NUMERIC,
  min_stock   NUMERIC,
  unit_type   TEXT
) AS $$
  SELECT p.name, p.brand, p.size, p.stock_qty, p.min_stock, p.unit_type
  FROM products p
  WHERE p.is_active = true
    AND p.stock_qty <= p.min_stock
  ORDER BY (p.stock_qty - p.min_stock) ASC;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── 3. Missing indexes for common query patterns ─────────────
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created
  ON purchase_orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_created
  ON expenses(created_at DESC);
