-- Fix products where inferPiecesPerUnit produced wrong ppu values
-- from garbled/mismatched pack_size strings in PDF receipts.

BEGIN;

-- AKHAN SPAGHETTI: size "500 3M (CTN)" → parser grabbed "5003" as ppu
-- Actually 20x500G per carton, 3 cartons purchased, receipt total=2400
-- rate=2400/3=800/carton, buy_price=800/20=40/pc, stock=3×20=60
UPDATE products SET
  pieces_per_unit = 20,
  size = '20x500G',
  buy_price = 40.00,
  stock_qty = 60,
  sell_price = 0,
  sell_price_piece = NULL
WHERE UPPER(name) = 'AKHAN SPAGHETTI' AND pieces_per_unit = 5003;

-- JIK REGULAR: size "750ML CTN" → parser grabbed "750" as ppu
-- Actually 12x750ML per carton, 1 carton purchased, receipt total=2950
-- buy_price=2950/12=245.83/bottle, stock=12
UPDATE products SET
  pieces_per_unit = 12,
  size = '12x750ML',
  buy_price = ROUND(2950.0 / 12, 2),
  stock_qty = 12,
  sell_price = 0,
  sell_price_piece = NULL
WHERE UPPER(name) = 'JIK REGULAR' AND pieces_per_unit = 750;

-- ROSALINDA SPAGETTI: no size, ppu=500 (likely manual entry of "500G" as ppu)
-- Actually 20x500G per carton, 3 cartons purchased, receipt total=7200
-- buy_price=7200/(3×20)=120/pc, stock=3×20=60
UPDATE products SET
  pieces_per_unit = 20,
  size = '20x500G',
  buy_price = 120.00,
  stock_qty = 60,
  sell_price = 0,
  sell_price_piece = NULL
WHERE UPPER(name) = 'ROSALINDA SPAGETTI' AND pieces_per_unit = 500;

-- ROSALINDA MACARONI SAMALL: no size, ppu=500
-- 20x500G per carton, 1 carton purchased, receipt total=1950
-- buy_price=1950/20=97.50/pc, stock=20
UPDATE products SET
  pieces_per_unit = 20,
  size = '20x500G',
  buy_price = 97.50,
  stock_qty = 20,
  sell_price = 0,
  sell_price_piece = NULL
WHERE UPPER(name) = 'ROSALINDA MACARONI SAMALL' AND pieces_per_unit = 500;

-- ROSALINDA MACAR PENNE: no size, ppu=500
-- 20x500G per carton, 1 carton purchased, receipt total=1950
-- buy_price=1950/20=97.50/pc, stock=20
UPDATE products SET
  pieces_per_unit = 20,
  size = '20x500G',
  buy_price = 97.50,
  stock_qty = 20,
  sell_price = 0,
  sell_price_piece = NULL
WHERE UPPER(name) = 'ROSALINDA  MACAR PENNE' AND pieces_per_unit = 500;

COMMIT;
