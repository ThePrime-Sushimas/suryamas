-- Migration: Link asset maintenance to vendors for invoice creation
-- Adds vendor_id (FK to vendors) so maintenance can navigate to general invoice create page

-- 1. Add vendor_id column (FK to vendors table)
ALTER TABLE asset_maintenance
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id);

-- 2. Index for vendor_id lookup
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_vendor_id
  ON asset_maintenance(vendor_id) WHERE vendor_id IS NOT NULL;
