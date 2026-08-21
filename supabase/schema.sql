-- ============================================================
-- Mabruk Store — Database Schema
-- Inventory + POS + Basic Financials + Credit (Deni)
--
-- FINAL STATE: reflects all migrations 001 through 008
--   001 — brand + pack columns (pack_qty later renamed)
--   002 — size column
--   003 — unit_type refactor (pieces_per_unit, sell_price_piece, supplier_name)
--   004 — suppliers table, vat_class, receipt tracking on purchase_orders,
--          expanded unit_type values, supplier_id FKs
--   005 — products.code (SKU)
--   006 — sales.cash_amount / mpesa_amount (split payment)
--   007 — sales.method CHECK fixed for 'split', get_low_stock_products() RPC,
--          idx_purchase_orders_created, idx_expenses_created
--   008 — record_credit_payment() RPC, deduct_stock_on_sale() prevents negative stock
-- ============================================================

-- ── Suppliers ─────────────────────────────────────────────────
create table suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text,
  phone      text,
  kra_pin    text,
  agent_no   text,
  store_no   text,
  notes      text,
  created_at timestamptz not null default now()
);

create index idx_suppliers_name on suppliers(name);

alter table suppliers enable row level security;
create policy anon_all on suppliers for all to anon using (true) with check (true);
create policy auth_all on suppliers for all to authenticated using (true) with check (true);

-- ── Products ─────────────────────────────────────────────────
create table products (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  brand            text,                              -- manufacturer (Dola, Ajab, EXE, etc.)
  category         text,                              -- e.g. 'Staples & Flour', 'Cooking Oils', etc.
  size             text,                              -- package size: '500g', '1kg', '3L', '1/2 L', etc.
  code             text,                              -- supplier SKU / barcode
  unit_type        text not null default 'PC',        -- 'PC', 'CTN', 'DZ', etc.
  pieces_per_unit  integer not null default 1,        -- how many pcs in a box/ctn (used when unit_type != 'PC')
  buy_price        numeric(10,2) not null default 0,  -- cost price per piece (auto-calc from box cost)
  sell_price       numeric(10,2) not null default 0,  -- selling price (per piece if PC, per box if CTN)
  sell_price_piece numeric(10,2),                     -- per-piece sell price (only when unit_type != 'PC')
  stock_qty        numeric(10,2) not null default 0,  -- current stock in sell units
  min_stock        numeric(10,2) not null default 5,  -- low stock threshold
  vat_class        text not null default 'A',         -- A = 16% standard, B = 0% zero-rated
  supplier_name    text,                              -- default supplier (denormalised copy)
  supplier_id      uuid references suppliers(id),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_products_active    on products(is_active);
create index idx_products_brand     on products(brand);
create index idx_products_code      on products(code);
create index idx_products_name_lower on products(lower(name));

alter table products enable row level security;
create policy anon_all on products for all to anon using (true) with check (true);

-- ── Stock Entries (goods received) ───────────────────────────
create table stock_entries (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id),
  quantity    numeric(10,2) not null,
  buy_price   numeric(10,2) not null,        -- price paid per unit for this batch
  supplier    text,                           -- supplier name (optional)
  supplier_id uuid references suppliers(id),
  notes       text,
  created_at  timestamptz not null default now()
);

create index idx_stock_entries_product on stock_entries(product_id);

alter table stock_entries enable row level security;
create policy anon_all on stock_entries for all to anon using (true) with check (true);

-- ── Sales ────────────────────────────────────────────────────
create table sales (
  id           uuid primary key default gen_random_uuid(),
  total        numeric(10,2) not null default 0,
  paid_amount  numeric(10,2) not null default 0,
  cash_amount  numeric not null default 0,    -- cash portion (split payment)
  mpesa_amount numeric not null default 0,    -- mpesa portion (split payment)
  method       text check (method in ('cash', 'mpesa', 'split')),
  mpesa_ref    text,
  client_name  text,                          -- for credit sales (deni)
  client_phone text,
  notes        text,
  created_at   timestamptz not null default now()
);

create index idx_sales_created on sales(created_at desc);

alter table sales enable row level security;
create policy anon_all on sales for all to anon using (true) with check (true);

-- ── Sale Items ───────────────────────────────────────────────
create table sale_items (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references sales(id) on delete cascade,
  product_id  uuid not null references products(id),
  quantity    numeric(10,2) not null,
  unit_price  numeric(10,2) not null,         -- sell price at time of sale
  buy_price   numeric(10,2) not null default 0, -- cost price at time of sale (for profit calc)
  line_total  numeric(10,2) not null,
  created_at  timestamptz not null default now()
);

create index idx_sale_items_sale    on sale_items(sale_id);
create index idx_sale_items_product on sale_items(product_id);

alter table sale_items enable row level security;
create policy anon_all on sale_items for all to anon using (true) with check (true);

-- ── Credits (Deni) ───────────────────────────────────────────
create table credits (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid references sales(id),
  client_name  text not null,
  client_phone text,
  amount       numeric(10,2) not null,        -- total owed
  paid         numeric(10,2) not null default 0,
  is_settled   boolean not null default false,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_credits_settled on credits(is_settled);

alter table credits enable row level security;
create policy anon_all on credits for all to anon using (true) with check (true);

-- ── Credit Payments ──────────────────────────────────────────
create table credit_payments (
  id          uuid primary key default gen_random_uuid(),
  credit_id   uuid not null references credits(id) on delete cascade,
  amount      numeric(10,2) not null,
  method      text check (method in ('cash', 'mpesa')),
  notes       text,
  created_at  timestamptz not null default now()
);

create index idx_credit_payments_credit on credit_payments(credit_id);

alter table credit_payments enable row level security;
create policy anon_all on credit_payments for all to anon using (true) with check (true);

-- ── Expenses (basic) ─────────────────────────────────────────
create table expenses (
  id          uuid primary key default gen_random_uuid(),
  description text not null,
  amount      numeric(10,2) not null,
  category    text,                           -- rent, transport, supplies, etc.
  created_at  timestamptz not null default now()
);

create index idx_expenses_created on expenses(created_at desc);

alter table expenses enable row level security;
create policy anon_all on expenses for all to anon using (true) with check (true);

-- ── Purchase Orders ──────────────────────────────────────────
-- Tracks goods received from a supplier in one batch
create table purchase_orders (
  id              uuid primary key default gen_random_uuid(),
  supplier_name   text not null,
  supplier_phone  text,
  supplier_id     uuid references suppliers(id),
  receipt_number  text,
  receipt_type    text,
  receipt_date    date,
  total_amount    numeric(12,2) not null default 0,
  paid_amount     numeric(12,2) not null default 0,
  discount        numeric(10,2) default 0,
  vat_total       numeric(10,2) default 0,
  served_by       text,
  customer_name   text,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_purchase_orders_created on purchase_orders(created_at desc);

alter table purchase_orders enable row level security;
create policy anon_all on purchase_orders for all to anon using (true) with check (true);

-- ── Purchase Order Items ─────────────────────────────────────
create table purchase_order_items (
  id                uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id        uuid references products(id),
  product_name      text not null,
  supplier_code     text,
  vat_class         text default 'A',
  unit_type         text,
  quantity          numeric(10,2) not null,   -- always in pieces
  buy_price         numeric(10,2) not null,   -- always per piece
  line_total        numeric(12,2) not null,
  created_at        timestamptz default now()
);

alter table purchase_order_items enable row level security;
create policy anon_all on purchase_order_items for all to anon using (true) with check (true);

-- ── Auto-update stock on stock entry ─────────────────────────
create or replace function update_stock_on_entry()
returns trigger as $$
begin
  update products
  set stock_qty = stock_qty + NEW.quantity,
      buy_price = NEW.buy_price,
      updated_at = now()
  where id = NEW.product_id;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_stock_entry_update
after insert on stock_entries
for each row execute function update_stock_on_entry();

-- ── Auto-deduct stock on sale (prevents negative stock) ──────
create or replace function deduct_stock_on_sale()
returns trigger as $$
declare
  v_current numeric;
begin
  select stock_qty into v_current
    from products where id = NEW.product_id;

  if v_current < NEW.quantity then
    raise exception 'Insufficient stock for product %: have %, need %',
      NEW.product_id, v_current, NEW.quantity;
  end if;

  update products
  set stock_qty = stock_qty - NEW.quantity,
      updated_at = now()
  where id = NEW.product_id;

  return NEW;
end;
$$ language plpgsql;

create trigger trg_sale_item_deduct
after insert on sale_items
for each row execute function deduct_stock_on_sale();

-- ── RPC: low-stock products ───────────────────────────────────
-- PostgREST .filter() compares against a literal string, not a column.
-- This RPC correctly compares stock_qty <= min_stock column-to-column.
create or replace function get_low_stock_products()
returns table (
  name      text,
  brand     text,
  size      text,
  stock_qty numeric,
  min_stock numeric,
  unit_type text
) as $$
  select p.name, p.brand, p.size, p.stock_qty, p.min_stock, p.unit_type
  from products p
  where p.is_active = true
    and p.stock_qty <= p.min_stock
  order by (p.stock_qty - p.min_stock) asc;
$$ language sql security definer;

-- ── RPC: atomic credit payment ────────────────────────────────
-- Inserts a credit_payment row and updates the credit balance
-- atomically, preventing partial-payment state on network errors.
create or replace function record_credit_payment(
  p_credit_id uuid,
  p_amount    numeric,
  p_method    text
) returns void as $$
declare
  v_credit   record;
  v_new_paid numeric;
  v_settled  boolean;
begin
  -- Lock the credit row to prevent concurrent updates
  select amount, paid into v_credit
    from credits where id = p_credit_id for update;

  if not found then
    raise exception 'Credit record not found';
  end if;

  v_new_paid := v_credit.paid + p_amount;
  v_settled  := v_new_paid >= v_credit.amount;

  insert into credit_payments (credit_id, amount, method)
  values (p_credit_id, p_amount, p_method);

  update credits
  set paid       = v_new_paid,
      is_settled = v_settled,
      updated_at = now()
  where id = p_credit_id;
end;
$$ language plpgsql security definer;
