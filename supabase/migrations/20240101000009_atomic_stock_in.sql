-- ============================================================
-- Migration 009: Atomic stock-in RPC
-- Wraps the entire purchase-order + stock-entry flow in a
-- single transaction so a failure at any point rolls back
-- everything (PO, PO items, stock_entries, product creates,
-- and the trigger-applied stock_qty bumps).
-- ============================================================

CREATE OR REPLACE FUNCTION receive_stock(
  p_supplier_name     TEXT,
  p_supplier_phone    TEXT DEFAULT NULL,
  p_supplier_id       UUID DEFAULT NULL,
  p_total_amount      NUMERIC DEFAULT 0,
  p_paid_amount       NUMERIC DEFAULT 0,
  p_notes             TEXT DEFAULT NULL,
  p_receipt_number    TEXT DEFAULT NULL,
  p_receipt_type      TEXT DEFAULT NULL,
  p_receipt_date      TEXT DEFAULT NULL,
  p_discount          NUMERIC DEFAULT 0,
  p_vat_total         NUMERIC DEFAULT 0,
  p_served_by         TEXT DEFAULT NULL,
  p_customer_name     TEXT DEFAULT NULL,
  p_items             JSONB DEFAULT '[]'
  -- Each item: { product_id, product_name, quantity, buy_price,
  --              line_total, supplier_code, vat_class, unit_type }
) RETURNS UUID AS $$
DECLARE
  v_order_id UUID;
  v_item     JSONB;
  v_product_id UUID;
BEGIN
  -- 1. Create the purchase order
  INSERT INTO purchase_orders (
    supplier_name, supplier_phone, supplier_id,
    total_amount, paid_amount, notes,
    receipt_number, receipt_type, receipt_date,
    discount, vat_total, served_by, customer_name
  ) VALUES (
    p_supplier_name, p_supplier_phone, p_supplier_id,
    p_total_amount, p_paid_amount, p_notes,
    p_receipt_number, p_receipt_type, p_receipt_date::DATE,
    p_discount, p_vat_total, p_served_by, p_customer_name
  ) RETURNING id INTO v_order_id;

  -- 2. Loop through items: insert PO line items + stock entries
  --    (stock_entries INSERT fires trg_stock_entry_update which
  --     bumps products.stock_qty — all inside this transaction)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item ->> 'product_id')::UUID;

    INSERT INTO purchase_order_items (
      purchase_order_id, product_id, product_name,
      quantity, buy_price, line_total,
      supplier_code, vat_class, unit_type
    ) VALUES (
      v_order_id,
      v_product_id,
      v_item ->> 'product_name',
      (v_item ->> 'quantity')::NUMERIC,
      (v_item ->> 'buy_price')::NUMERIC,
      (v_item ->> 'line_total')::NUMERIC,
      v_item ->> 'supplier_code',
      v_item ->> 'vat_class',
      v_item ->> 'unit_type'
    );

    INSERT INTO stock_entries (
      product_id, quantity, buy_price,
      supplier, supplier_id
    ) VALUES (
      v_product_id,
      (v_item ->> 'quantity')::NUMERIC,
      (v_item ->> 'buy_price')::NUMERIC,
      p_supplier_name,
      p_supplier_id
    );
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
