-- ── Guard against overpayment on credit records ─────────────────────────────
-- Adds two checks to record_credit_payment():
--   1. Payment amount must be positive.
--   2. Payment must not exceed the outstanding balance (with a 1-cent tolerance
--      for floating-point rounding — e.g. 0.01 KES).
-- Without this, a fat-finger entry (e.g. typing 5000 instead of 500) would push
-- credits.paid above credits.amount, making the balance go negative and breaking
-- the Outstanding Obligations total on the Finances page.

CREATE OR REPLACE FUNCTION record_credit_payment(
  p_credit_id UUID,
  p_amount    NUMERIC,
  p_method    TEXT
) RETURNS VOID AS $$
DECLARE
  v_credit   RECORD;
  v_new_paid NUMERIC;
  v_settled  BOOLEAN;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive (got %)', p_amount;
  END IF;

  -- Lock the credit row to prevent concurrent updates
  SELECT amount, paid, sale_id INTO v_credit
    FROM credits WHERE id = p_credit_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit record not found';
  END IF;

  -- Block overpayment (1-cent tolerance for floating-point rounding)
  IF v_credit.paid + p_amount > v_credit.amount + 0.01 THEN
    RAISE EXCEPTION 'Payment of % exceeds outstanding balance of % (already paid: %, total: %)',
      p_amount,
      GREATEST(0, v_credit.amount - v_credit.paid),
      v_credit.paid,
      v_credit.amount;
  END IF;

  v_new_paid := v_credit.paid + p_amount;
  v_settled  := v_new_paid >= v_credit.amount - 0.01;

  INSERT INTO credit_payments (credit_id, amount, method)
  VALUES (p_credit_id, p_amount, p_method);

  UPDATE credits
  SET paid       = v_new_paid,
      is_settled = v_settled,
      updated_at = now()
  WHERE id = p_credit_id;

  -- Keep sales.paid_amount in sync so sales history shows correct outstanding
  IF v_credit.sale_id IS NOT NULL THEN
    UPDATE sales
    SET paid_amount = paid_amount + p_amount
    WHERE id = v_credit.sale_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
