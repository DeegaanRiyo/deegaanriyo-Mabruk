-- ============================================================
-- Migration 013: Sale deletion — stock replenishment + owner-only
-- ============================================================

-- ── 1. Replenish stock when sale_items are deleted ─────────
CREATE OR REPLACE FUNCTION replenish_stock_on_sale_item_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET stock_qty = stock_qty + OLD.quantity,
      updated_at = now()
  WHERE id = OLD.product_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sale_item_replenish
BEFORE DELETE ON sale_items
FOR EACH ROW EXECUTE FUNCTION replenish_stock_on_sale_item_delete();

-- ── 2. Fix credits FK so sale deletion cascades cleanly ────
-- credits.sale_id has no ON DELETE action — add SET NULL
-- (the credit record survives as an orphan debt if needed,
--  but won't block sale deletion)
ALTER TABLE credits
  DROP CONSTRAINT IF EXISTS credits_sale_id_fkey,
  ADD CONSTRAINT credits_sale_id_fkey
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL;

-- ── 3. Owner-only DELETE on sales ──────────────────────────
-- Drop existing broad "FOR ALL" policies, replace with granular ones
DROP POLICY IF EXISTS anon_all   ON sales;
DROP POLICY IF EXISTS sales_anon ON sales;
DROP POLICY IF EXISTS sales_auth ON sales;

CREATE POLICY sales_anon_select  ON sales FOR SELECT TO anon          USING (true);
CREATE POLICY sales_anon_insert  ON sales FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY sales_anon_update  ON sales FOR UPDATE TO anon          USING (true) WITH CHECK (true);

CREATE POLICY sales_auth_select  ON sales FOR SELECT TO authenticated USING (true);
CREATE POLICY sales_auth_insert  ON sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY sales_auth_update  ON sales FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY sales_auth_delete  ON sales FOR DELETE TO authenticated USING (is_owner());

-- ── 4. Owner-only DELETE on sale_items (direct queries) ────
DROP POLICY IF EXISTS anon_all ON sale_items;
DROP POLICY IF EXISTS si_anon  ON sale_items;
DROP POLICY IF EXISTS si_auth  ON sale_items;

CREATE POLICY si_anon_select  ON sale_items FOR SELECT TO anon          USING (true);
CREATE POLICY si_anon_insert  ON sale_items FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY si_anon_update  ON sale_items FOR UPDATE TO anon          USING (true) WITH CHECK (true);

CREATE POLICY si_auth_select  ON sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY si_auth_insert  ON sale_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY si_auth_update  ON sale_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY si_auth_delete  ON sale_items FOR DELETE TO authenticated USING (is_owner());
