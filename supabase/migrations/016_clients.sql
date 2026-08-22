-- ============================================================================
-- 016: Clients table — first-class customer entity
-- ============================================================================
-- Previously client info was stored as plain text on sales/credits.
-- This migration creates a proper clients table, extracts existing clients
-- from historical data, and backfills the FK relationships.
-- ============================================================================

-- ── 1. Create clients table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  phone      TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_name_lower ON clients(lower(name));
CREATE INDEX idx_clients_phone ON clients(phone);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY clients_anon  ON clients FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY clients_auth  ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 2. Add client_id FK to sales and credits ────────────────────────────────

ALTER TABLE sales   ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE credits ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_client   ON sales(client_id);
CREATE INDEX IF NOT EXISTS idx_credits_client ON credits(client_id);

-- ── 3. Extract unique clients from existing data ────────────────────────────

-- Credits first (client_name is NOT NULL there — best data quality)
INSERT INTO clients (name, phone)
SELECT DISTINCT ON (lower(trim(client_name)))
  trim(client_name),
  client_phone
FROM credits
WHERE trim(client_name) != ''
ORDER BY lower(trim(client_name)), created_at DESC;

-- Then sales — only names not already captured from credits
INSERT INTO clients (name, phone)
SELECT DISTINCT ON (lower(trim(client_name)))
  trim(client_name),
  client_phone
FROM sales
WHERE client_name IS NOT NULL
  AND trim(client_name) != ''
  AND lower(trim(client_name)) NOT IN (SELECT lower(name) FROM clients)
ORDER BY lower(trim(client_name)), created_at DESC;

-- ── 4. Backfill client_id on existing records ───────────────────────────────

UPDATE credits SET client_id = c.id
FROM clients c
WHERE lower(trim(credits.client_name)) = lower(c.name)
  AND credits.client_id IS NULL;

UPDATE sales SET client_id = c.id
FROM clients c
WHERE sales.client_name IS NOT NULL
  AND lower(trim(sales.client_name)) = lower(c.name)
  AND sales.client_id IS NULL;

-- ── 5. Auto-update updated_at trigger ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_clients_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION update_clients_updated_at();

-- ── 6. RPC: get_client_summary — aggregated client list ─────────────────────

CREATE OR REPLACE FUNCTION get_client_summary()
RETURNS TABLE (
  id          UUID,
  name        TEXT,
  phone       TEXT,
  notes       TEXT,
  total_owed  NUMERIC,
  total_sales BIGINT,
  last_sale   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ
) AS $$
  SELECT
    c.id, c.name, c.phone, c.notes,
    COALESCE(SUM(CASE WHEN cr.is_settled = false THEN cr.amount - cr.paid ELSE 0 END), 0) AS total_owed,
    COUNT(DISTINCT s.id) AS total_sales,
    MAX(s.created_at) AS last_sale,
    c.created_at
  FROM clients c
  LEFT JOIN credits cr ON cr.client_id = c.id
  LEFT JOIN sales s ON s.client_id = c.id
  GROUP BY c.id, c.name, c.phone, c.notes, c.created_at
  ORDER BY total_owed DESC, c.name ASC;
$$ LANGUAGE sql SECURITY DEFINER;
