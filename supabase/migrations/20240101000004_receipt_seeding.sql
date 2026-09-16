-- ============================================================
-- Migration 004: Receipt Seeding Infrastructure
-- Suppliers table, expanded unit types, VAT, receipt tracking
-- ============================================================

-- ── 1. Suppliers table ──────────────────────────────────────
CREATE TABLE suppliers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  address    TEXT,
  phone      TEXT,
  kra_pin    TEXT,
  agent_no   TEXT,
  store_no   TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_name ON suppliers(name);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_all ON suppliers FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── 2. Add supplier_id FK to existing tables ────────────────
ALTER TABLE products         ADD COLUMN supplier_id UUID REFERENCES suppliers(id);
ALTER TABLE stock_entries    ADD COLUMN supplier_id UUID REFERENCES suppliers(id);
ALTER TABLE purchase_orders  ADD COLUMN supplier_id UUID REFERENCES suppliers(id);

-- ── 3. Backfill: create supplier rows from existing text data ──
-- Create a supplier for each distinct supplier_name in purchase_orders
INSERT INTO suppliers (name, phone)
SELECT DISTINCT supplier_name, supplier_phone
FROM purchase_orders
WHERE supplier_name IS NOT NULL
ON CONFLICT DO NOTHING;

-- Link purchase_orders to their supplier
UPDATE purchase_orders po
SET supplier_id = s.id
FROM suppliers s
WHERE LOWER(po.supplier_name) = LOWER(s.name);

-- Link products to their supplier
UPDATE products p
SET supplier_id = s.id
FROM suppliers s
WHERE LOWER(p.supplier_name) = LOWER(s.name);

-- ── 4. Expand unit_type values ──────────────────────────────
-- Convert old 'piece' → 'PC', 'box' → 'CTN' (most common multi-unit type)
UPDATE products SET unit_type = 'PC'  WHERE unit_type = 'piece';
UPDATE products SET unit_type = 'CTN' WHERE unit_type = 'box';

-- Change default
ALTER TABLE products ALTER COLUMN unit_type SET DEFAULT 'PC';

-- ── 5. Add VAT support ─────────────────────────────────────
ALTER TABLE products ADD COLUMN vat_class TEXT NOT NULL DEFAULT 'A';
-- A = 16% standard, B = 0% zero-rated

-- ── 6. Receipt tracking on purchase_orders ──────────────────
ALTER TABLE purchase_orders ADD COLUMN receipt_number TEXT;
ALTER TABLE purchase_orders ADD COLUMN receipt_type   TEXT;
ALTER TABLE purchase_orders ADD COLUMN receipt_date   DATE;
ALTER TABLE purchase_orders ADD COLUMN discount       NUMERIC(10,2) DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN vat_total      NUMERIC(10,2) DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN served_by      TEXT;
ALTER TABLE purchase_orders ADD COLUMN customer_name  TEXT;

-- ── 7. Line-level receipt data on purchase_order_items ───────
ALTER TABLE purchase_order_items ADD COLUMN supplier_code TEXT;
ALTER TABLE purchase_order_items ADD COLUMN vat_class     TEXT DEFAULT 'A';
ALTER TABLE purchase_order_items ADD COLUMN unit_type     TEXT;

-- ── 8. Index for product matching during receipt seeding ────
CREATE INDEX idx_products_name_lower ON products(LOWER(name));
