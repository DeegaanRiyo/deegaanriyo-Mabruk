-- ============================================================
-- Migration: Add brand + pack-to-unit conversion
-- ============================================================
-- Use case: Flour comes in bales of 24 × 500g packets.
--   brand     = 'Dola'
--   pack_qty  = 24   (sell-units per wholesale pack)
--   pack_cost = 2400 (KES per bale from supplier)
--   buy_price = 100  (auto: 2400 ÷ 24 = cost per packet)
--   sell_price = 120 (what customer pays per packet)
-- ============================================================

-- Add new columns
alter table products add column if not exists brand     text;
alter table products add column if not exists pack_qty  integer not null default 1;
alter table products add column if not exists pack_cost numeric(10,2) not null default 0;

-- Index for brand filtering
create index if not exists idx_products_brand on products(brand);
