-- ── Fix: sync sales.paid_amount when credit payments are recorded ────────────
-- Previously, record_credit_payment only updated credits.paid but left
-- sales.paid_amount stale — causing the sales history to show wrong outstanding.

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
  -- Lock the credit row to prevent concurrent updates
  SELECT amount, paid, sale_id INTO v_credit
    FROM credits WHERE id = p_credit_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit record not found';
  END IF;

  v_new_paid := v_credit.paid + p_amount;
  v_settled  := v_new_paid >= v_credit.amount;

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
