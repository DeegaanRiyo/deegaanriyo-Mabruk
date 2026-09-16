-- ============================================================
-- Migration 011: RLS policies for authenticated users
-- Before auth was added, tables used anon-only policies.
-- Now authenticated users need access too.
-- ============================================================

-- ── Suppliers ──────────────────────────────────────────────
-- Already has RLS enabled with anon_all policy; add authenticated
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='suppliers' AND policyname='auth_all') THEN
    CREATE POLICY auth_all ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Products ───────────────────────────────────────────────
-- Enable RLS if not already, then grant both roles
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='products_anon') THEN
    CREATE POLICY products_anon ON products FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='products_auth') THEN
    CREATE POLICY products_auth ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Purchase Orders ────────────────────────────────────────
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY po_anon  ON purchase_orders FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY po_auth  ON purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Purchase Order Items ───────────────────────────────────
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY poi_anon  ON purchase_order_items FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY poi_auth  ON purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Stock Entries ──────────────────────────────────────────
ALTER TABLE stock_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY se_anon  ON stock_entries FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY se_auth  ON stock_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Sales ──────────────────────────────────────────────────
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_anon  ON sales FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY sales_auth  ON sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Sale Items ─────────────────────────────────────────────
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY si_anon  ON sale_items FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY si_auth  ON sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Credits ────────────────────────────────────────────────
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY credits_anon  ON credits FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY credits_auth  ON credits FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Credit Payments ────────────────────────────────────────
ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY cp_anon  ON credit_payments FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY cp_auth  ON credit_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Expenses ───────────────────────────────────────────────
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY expenses_anon  ON expenses FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY expenses_auth  ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
