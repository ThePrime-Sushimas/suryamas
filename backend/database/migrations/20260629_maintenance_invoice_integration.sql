-- Migration: Link asset maintenance to general invoices for payment
-- Adds vendor_id (FK to vendors), general_invoice_id (FK to general_invoices)
-- Adds new status 'INVOICED' to asset_maintenance

-- 1. Add vendor_id column (FK to vendors table)
ALTER TABLE asset_maintenance
  ADD COLUMN vendor_id UUID REFERENCES vendors(id);

-- 2. Add general_invoice_id column (FK to general_invoices table)
ALTER TABLE asset_maintenance
  ADD COLUMN general_invoice_id UUID REFERENCES general_invoices(id);

-- 3. Backfill vendor_id is NOT needed — existing POSTED data left as-is

-- 4. Update status check constraint to allow 'INVOICED'
-- First drop the old constraint if exists
ALTER TABLE asset_maintenance
  DROP CONSTRAINT IF EXISTS asset_maintenance_status_check;

-- Re-create with new valid values (IN_PROGRESS, COMPLETED, POSTED, INVOICED)
-- Keep POSTED for backward compat with existing data
ALTER TABLE asset_maintenance
  ADD CONSTRAINT asset_maintenance_status_check
  CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'POSTED', 'INVOICED'));

-- 5. Index for vendor_id lookup
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_vendor_id
  ON asset_maintenance(vendor_id) WHERE vendor_id IS NOT NULL;

-- 6. Index for general_invoice_id lookup
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_general_invoice_id
  ON asset_maintenance(general_invoice_id) WHERE general_invoice_id IS NOT NULL;
