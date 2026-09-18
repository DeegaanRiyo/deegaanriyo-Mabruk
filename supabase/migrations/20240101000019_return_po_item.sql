-- ============================================================
-- Migration 019: Return / remove a single line from a PO
-- ============================================================
-- return_po_item(p_po_item_id)
--
-- Decision tree for the stock_entry:
--   products.stock_qty >= po_item.quantity
--     → ALL received stock is still on hand (nothing sold yet).
--       Find and delete the matching stock_entry so the receipt
--       history is clean.  Then subtract the full quantity.
--   products.stock_qty < po_item.quantity
--     → Some (or all) of that stock was already sold.
--       Leave stock_entries alone (audit trail) and only reduce
--       stock_qty by however much is still on hand (≥ 0).
--
-- After removing the line item:
--   If the PO now has zero remaining items → delete the whole PO.
--
-- Returns JSONB:
--   { order_deleted: bool, product_id: uuid, qty_returned: numeric }
-- ============================================================

CREATE OR REPLACE FUNCTION return_po_item(
  p_po_item_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_item           RECORD;
  v_current_stock  NUMERIC;
  v_stock_entry_id UUID;
  v_remaining      INT;
  v_order_deleted  BOOLEAN := FALSE;
BEGIN
  -- 1. Lock and fetch the PO item (+ parent PO totals)
  SELECT
    poi.id,
    poi.purchase_order_id,
    poi.product_id,
    poi.product_name,
    poi.quantity,
    poi.buy_price,
    poi.line_total,
    po.total_amount  AS po_total,
    po.paid_amount   AS po_paid
  INTO v_item
  FROM purchase_order_items poi
  JOIN purchase_orders po ON po.id = poi.purchase_order_id
  WHERE poi.id = p_po_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order item % not found', p_po_item_id;
  END IF;

  -- 2. Get current stock for this product (may be NULL if product deleted)
  IF v_item.product_id IS NOT NULL THEN
    SELECT stock_qty INTO v_current_stock
    FROM products
    WHERE id = v_item.product_id;
  ELSE
    v_current_stock := 0;
  END IF;

  -- 3. Decide whether we can cleanly delete the stock_entry
  IF v_item.product_id IS NOT NULL AND COALESCE(v_current_stock, 0) >= v_item.quantity THEN
    -- All received stock is still on hand → safe to wipe the stock_entry
    SELECT id INTO v_stock_entry_id
    FROM stock_entries
    WHERE product_id = v_item.product_id
      AND ABS(buy_price - v_item.buy_price) < 0.01
      AND quantity    = v_item.quantity
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_stock_entry_id IS NOT NULL THEN
      -- Deleting the stock_entry does NOT auto-reverse stock_qty
      -- (trigger only fires on INSERT, not DELETE) so we subtract manually below.
      DELETE FROM stock_entries WHERE id = v_stock_entry_id;
    END IF;

    -- Subtract the full received quantity
    UPDATE products
    SET stock_qty  = stock_qty - v_item.quantity,
        updated_at = now()
    WHERE id = v_item.product_id;

  ELSIF v_item.product_id IS NOT NULL THEN
    -- Some stock was already sold — reduce to zero at most, leave entries intact
    UPDATE products
    SET stock_qty  = GREATEST(0, stock_qty - v_item.quantity),
        updated_at = now()
    WHERE id = v_item.product_id;
  END IF;

  -- 4. Remove the PO line item
  --    (purchase_order_items.purchase_order_id has ON DELETE CASCADE
  --     going the other way, but we're deleting the item, not the parent)
  DELETE FROM purchase_order_items WHERE id = p_po_item_id;

  -- 5. Reduce the PO total (never go below zero)
  UPDATE purchase_orders
  SET total_amount = GREATEST(0, total_amount - v_item.line_total),
      updated_at   = now()
  WHERE id = v_item.purchase_order_id;

  -- 6. If no lines remain, delete the whole PO
  SELECT COUNT(*) INTO v_remaining
  FROM purchase_order_items
  WHERE purchase_order_id = v_item.purchase_order_id;

  IF v_remaining = 0 THEN
    DELETE FROM purchase_orders WHERE id = v_item.purchase_order_id;
    v_order_deleted := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'order_deleted', v_order_deleted,
    'product_id',    v_item.product_id,
    'qty_returned',  v_item.quantity
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
