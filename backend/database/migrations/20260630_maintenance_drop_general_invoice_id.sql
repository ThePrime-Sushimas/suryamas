-- Migration: Remove general_invoice_id and INVOICED status from asset_maintenance
-- The invoice flow is now handled via navigation (query params) to general invoices page,
-- no direct link between maintenance and invoice records needed.

-- 1. Drop index on general_invoice_id (if exists from previous migration)
DROP INDEX IF EXISTS idx_asset_maintenance_general_invoice_id;

-- 2. Drop general_invoice_id column
ALTER TABLE asset_maintenance
  DROP COLUMN IF EXISTS general_invoice_id;

-- 3. Revert status constraint to original values (remove INVOICED, keep POSTED for legacy data)
ALTER TABLE asset_maintenance
  DROP CONSTRAINT IF EXISTS asset_maintenance_status_check;

ALTER TABLE asset_maintenance
  ADD CONSTRAINT asset_maintenance_status_check
  CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'POSTED'));
