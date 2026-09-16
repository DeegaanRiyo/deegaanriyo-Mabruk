-- Add pieces_per_unit to get_low_stock_products RPC
DROP FUNCTION IF EXISTS get_low_stock_products();
CREATE OR REPLACE FUNCTION get_low_stock_products()
RETURNS TABLE (
  name        TEXT,
  brand       TEXT,
  size        TEXT,
  stock_qty   NUMERIC,
  min_stock   NUMERIC,
  unit_type   TEXT,
  pieces_per_unit INTEGER
) AS $$
  SELECT p.name, p.brand, p.size, p.stock_qty, p.min_stock, p.unit_type, p.pieces_per_unit
  FROM products p
  WHERE p.is_active = true
    AND p.stock_qty <= p.min_stock
  ORDER BY (p.stock_qty - p.min_stock) ASC;
$$ LANGUAGE sql SECURITY DEFINER;
