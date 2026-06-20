-- Pooled Asset Tracking: adds tracking_method to categories and quantity/uom to fixed_assets
-- Enables POOLED tracking for high-volume consumable assets (sumpit, piring, etc.)

BEGIN;

-- ============================================================
-- 1. Add tracking_method to asset_categories
-- ============================================================
ALTER TABLE asset_categories
  ADD COLUMN tracking_method VARCHAR(15) NOT NULL DEFAULT 'INDIVIDUAL'
    CHECK (tracking_method IN ('INDIVIDUAL', 'POOLED'));

COMMENT ON COLUMN asset_categories.tracking_method IS
  'INDIVIDUAL = 1 record per physical unit (default, backward compat). POOLED = 1 record per SKU+branch pool.';

-- ============================================================
-- 2. Add quantity and uom to fixed_assets
-- ============================================================
ALTER TABLE fixed_assets
  ADD COLUMN quantity INT NOT NULL DEFAULT 1,
  ADD COLUMN uom VARCHAR(20) NOT NULL DEFAULT 'UNIT';

-- Constraint: quantity must be positive
ALTER TABLE fixed_assets
  ADD CONSTRAINT chk_fixed_assets_quantity_positive CHECK (quantity >= 0);

COMMENT ON COLUMN fixed_assets.quantity IS
  'Number of units in this asset record. Always 1 for INDIVIDUAL tracking. Can be >1 for POOLED.';
COMMENT ON COLUMN fixed_assets.uom IS
  'Base unit of measure. POOLED assets always stored in base UoM (e.g. PCS), not purchase UoM (e.g. LUSIN).';

-- ============================================================
-- 3. Add quantity_disposed to asset_disposals for partial disposal
-- ============================================================
ALTER TABLE asset_disposals
  ADD COLUMN quantity_disposed INT;

COMMENT ON COLUMN asset_disposals.quantity_disposed IS
  'Number of units disposed (for POOLED assets). NULL for INDIVIDUAL assets (always full disposal).';

COMMIT;
