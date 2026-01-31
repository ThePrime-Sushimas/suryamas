-- Migration: Add fee breakdown columns to aggregated_transactions
-- Date: 2025-01-17
-- Purpose: Add percentage_fee_amount, fixed_fee_amount, total_fee_amount columns for payment method fee transparency

-- Drop migration if exists (for re-runnability)
-- DROP MATERIALIZED VIEW IF EXISTS mv_aggregated_transactions_summary;

-- ============================================
-- ADD NEW COLUMNS
-- ============================================

-- Add percentage_fee_amount column (default 0)
ALTER TABLE aggregated_transactions
ADD COLUMN IF NOT EXISTS percentage_fee_amount NUMERIC(15, 2) DEFAULT 0 NOT NULL;

-- Add fixed_fee_amount column (default 0)
ALTER TABLE aggregated_transactions
ADD COLUMN IF NOT EXISTS fixed_fee_amount NUMERIC(15, 2) DEFAULT 0 NOT NULL;

-- Add total_fee_amount column (default 0)
ALTER TABLE aggregated_transactions
ADD COLUMN IF NOT EXISTS total_fee_amount NUMERIC(15, 2) DEFAULT 0 NOT NULL;

-- ============================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN aggregated_transactions.percentage_fee_amount IS 'Fee calculated from percentage (gross_amount × fee_percentage / 100)';
COMMENT ON COLUMN aggregated_transactions.fixed_fee_amount IS 'Fixed fee amount (per transaction or per total settlement)';
COMMENT ON COLUMN aggregated_transactions.total_fee_amount IS 'Total fee (percentage_fee_amount + fixed_fee_amount)';

-- ============================================
-- UPDATE EXISTING RECORDS
-- ============================================

-- Update existing records to set total_fee_amount = 0 (all historical records have no fees yet)
UPDATE aggregated_transactions
SET 
  percentage_fee_amount = 0,
  fixed_fee_amount = 0,
  total_fee_amount = 0
WHERE total_fee_amount IS NULL;

-- ============================================
-- ADD CONSTRAINT FOR VALIDATION
-- ============================================

-- Add check constraint: net_amount should be gross - discount - total_fee
-- Note: This constraint allows for existing data, but new inserts should follow the formula
-- The formula is: net_amount = gross_amount - discount_amount - total_fee_amount
-- Note: tax and service_charge are already included in gross_amount based on the business logic

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE (OPTIONAL)
-- ============================================

-- Index for fee-related queries (useful for reconciliation reports)
CREATE INDEX IF NOT EXISTS idx_aggregated_transactions_total_fee_amount
ON aggregated_transactions(total_fee_amount) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_aggregated_transactions_percentage_fee_amount
ON aggregated_transactions(percentage_fee_amount) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_aggregated_transactions_fixed_fee_amount
ON aggregated_transactions(fixed_fee_amount) 
WHERE deleted_at IS NULL;

-- ============================================
-- ROLLBACK SCRIPT (for documentation)
-- ============================================

/*
-- To rollback this migration, run:
ALTER TABLE aggregated_transactions
DROP COLUMN IF EXISTS percentage_fee_amount;

ALTER TABLE aggregated_transactions
DROP COLUMN IF EXISTS fixed_fee_amount;

ALTER TABLE aggregated_transactions
DROP COLUMN IF EXISTS total_fee_amount;

DROP INDEX IF EXISTS idx_aggregated_transactions_total_fee_amount;
DROP INDEX IF EXISTS idx_aggregated_transactions_percentage_fee_amount;
DROP INDEX IF EXISTS idx_aggregated_transactions_fixed_fee_amount;
*/

