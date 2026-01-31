-- Migration: Rename net_amount to nett_amount and add bill_after_discount
-- Date: 2025-01-20
-- Purpose: Rename net_amount column to nett_amount and add bill_after_discount column for fee breakdown

-- ============================================
-- RENAME EXISTING COLUMN
-- ============================================

-- Rename net_amount to nett_amount (if exists)
ALTER TABLE aggregated_transactions
RENAME COLUMN net_amount TO nett_amount;

-- ============================================
-- ADD BILL_AFTER_DISCOUNT COLUMN
-- ============================================

-- Add bill_after_discount column (default 0)
ALTER TABLE aggregated_transactions
ADD COLUMN IF NOT EXISTS bill_after_discount NUMERIC(15, 2) DEFAULT 0 NOT NULL;

-- ============================================
-- UPDATE EXISTING RECORDS
-- ============================================

-- For existing records, set bill_after_discount = nett_amount + total_fee_amount
-- (since bill_after_discount = nett_amount + total_fee_amount)
UPDATE aggregated_transactions
SET bill_after_discount = nett_amount + total_fee_amount
WHERE bill_after_discount = 0 OR bill_after_discount IS NULL;

-- ============================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN aggregated_transactions.bill_after_discount IS 'Subtotal + Tax - Discount (before fee deduction)';
COMMENT ON COLUMN aggregated_transactions.nett_amount IS 'Final amount after fee deduction (bill_after_discount - total_fee_amount)';

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE (OPTIONAL)
-- ============================================

-- Index for bill_after_discount queries
CREATE INDEX IF NOT EXISTS idx_aggregated_transactions_bill_after_discount
ON aggregated_transactions(bill_after_discount)
WHERE deleted_at IS NULL;

-- ============================================
-- ROLLBACK SCRIPT (for documentation)
-- ============================================

/*
-- To rollback this migration, run:
ALTER TABLE aggregated_transactions
DROP COLUMN IF EXISTS bill_after_discount;

ALTER TABLE aggregated_transactions
RENAME COLUMN nett_amount TO net_amount;

DROP INDEX IF EXISTS idx_aggregated_transactions_bill_after_discount;
*/

