-- ============================================================
-- Migration 006: Split Payment Support
-- Allow sales to record both cash and mpesa amounts
-- ============================================================

-- Add split payment columns
ALTER TABLE sales ADD COLUMN cash_amount  NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN mpesa_amount NUMERIC NOT NULL DEFAULT 0;

-- Expand method to include 'split'
-- (method is just text in the DB, no enum constraint)

-- Backfill existing sales based on current method
UPDATE sales SET cash_amount  = paid_amount WHERE method = 'cash';
UPDATE sales SET mpesa_amount = paid_amount WHERE method = 'mpesa';
