-- Migration: Add fixed_asset_id to petty_cash_expenses
-- Run this against your database before deploying the backend changes.

ALTER TABLE petty_cash_expenses
  ADD COLUMN IF NOT EXISTS fixed_asset_id UUID REFERENCES fixed_assets(id);

-- Optional: index for lookups from the fixed asset side
CREATE INDEX IF NOT EXISTS idx_petty_cash_expenses_fixed_asset_id
  ON petty_cash_expenses (fixed_asset_id)
  WHERE fixed_asset_id IS NOT NULL;
