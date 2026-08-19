-- Add size column for package/weight info (e.g. '500g', '1kg', '3L', '80 pcs')
ALTER TABLE products ADD COLUMN IF NOT EXISTS size text;
