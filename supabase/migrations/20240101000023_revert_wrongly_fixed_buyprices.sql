-- Revert products where the buy_price was actually correct (per-piece cost
-- was reasonable) but got inflated by the previous migration.
-- These are products with small/cheap individual units where the per-piece
-- wholesale cost really is under 6 KES (tiny sachets, basic bulk items).

BEGIN;

-- VASELINE 144x45ML: 4.86/jar was correct for tiny 45ML
-- Current: buy_price=700 (wrong, that's per-carton), sell_price=0
UPDATE products SET
  buy_price = ROUND(buy_price / pieces_per_unit, 2),
  sell_price = buy_price,       -- restore carton price
  sell_price_piece = NULL
WHERE UPPER(name) = 'VASELINE' AND pieces_per_unit = 144 AND buy_price = 700;

-- COLGATE TB ANTICAVITY 144: 2.50/brush was correct for bulk basic
UPDATE products SET
  buy_price = ROUND(buy_price / pieces_per_unit, 2),
  sell_price = buy_price,
  sell_price_piece = NULL
WHERE UPPER(name) = 'COLGATE TB ANTICAVITY' AND pieces_per_unit = 144 AND buy_price = 360;

-- COLGATE RED 144x35G: 5.21/tube was correct for tiny 35G tubes
UPDATE products SET
  buy_price = ROUND(buy_price / pieces_per_unit, 2),
  sell_price = buy_price,
  sell_price_piece = NULL
WHERE UPPER(name) = 'COLGATE RED' AND pieces_per_unit = 144 AND buy_price = 750;

-- BG TEA 40x25GRM: 3/sachet was correct for bulk tea bags
UPDATE products SET
  buy_price = ROUND(buy_price / pieces_per_unit, 2),
  sell_price = buy_price,
  sell_price_piece = NULL
WHERE UPPER(name) = 'BG TEA' AND pieces_per_unit = 40 AND buy_price = 120;

-- MACSARO 20LITAR: 30.50/liter was correct for bulk liquid
UPDATE products SET
  buy_price = ROUND(buy_price / pieces_per_unit, 2),
  sell_price = buy_price,
  sell_price_piece = NULL
WHERE UPPER(name) = 'MACSARO' AND pieces_per_unit = 20 AND buy_price = 610;

COMMIT;
