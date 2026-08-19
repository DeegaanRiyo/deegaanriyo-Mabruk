-- ============================================================
-- Migration 008: High Priority Fixes
-- 1. Atomic credit payment RPC (prevents partial payment state)
-- 2. Prevent negative stock in deduct trigger
-- ============================================================

-- ── 1. Atomic credit payment ─────────────────────────────────
-- Previously: two separate mutations (insert credit_payment + update credit)
-- Now: single RPC call that does both atomically in a transaction.

CREATE OR REPLACE FUNCTION record_credit_payment(
  p_credit_id UUID,
  p_amount    NUMERIC,
  p_method    TEXT
) RETURNS VOID AS $$
DECLARE
  v_credit RECORD;
  v_new_paid NUMERIC;
  v_settled  BOOLEAN;
BEGIN
  -- Lock the credit row to prevent concurrent updates
  SELECT amount, paid INTO v_credit
    FROM credits WHERE id = p_credit_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit record not found';
  END IF;

  v_new_paid := v_credit.paid + p_amount;
  v_settled  := v_new_paid >= v_credit.amount;

  INSERT INTO credit_payments (credit_id, amount, method)
  VALUES (p_credit_id, p_amount, p_method);

  UPDATE credits
  SET paid = v_new_paid,
      is_settled = v_settled,
      updated_at = now()
  WHERE id = p_credit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. Prevent negative stock ────────────────────────────────
-- Replace trigger function to raise an error when stock would go below 0.

CREATE OR REPLACE FUNCTION deduct_stock_on_sale()
RETURNS trigger AS $$
DECLARE
  v_current NUMERIC;
BEGIN
  SELECT stock_qty INTO v_current
    FROM products WHERE id = NEW.product_id;

  IF v_current < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock for product %: have %, need %',
      NEW.product_id, v_current, NEW.quantity;
  END IF;

  UPDATE products
  SET stock_qty = stock_qty - NEW.quantity,
      updated_at = now()
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
