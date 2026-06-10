-- ============================================================================
-- ADD OUT_PROCESSING MOVEMENT TYPE
-- Adds OUT_PROCESSING to distinguish breakdown/processing outbound movements
-- from actual waste (OUT_WASTE). This makes stock movement reports clearer:
-- - OUT_WASTE = barang terbuang (expired, rusak, susut opname)
-- - OUT_PROCESSING = bahan keluar untuk diproses jadi produk lain (breakdown)
-- ============================================================================

-- 1. Extend stock_movements movement_type CHECK to include OUT_PROCESSING
ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check,
  ADD CONSTRAINT stock_movements_movement_type_check
    CHECK (movement_type IN (
      'IN_PURCHASE', 'IN_TRANSFER', 'IN_RETURN', 'IN_PRODUCTION',
      'IN_ADJUSTMENT', 'IN_OPENING', 'IN_REVERSAL',
      'OUT_TRANSFER', 'OUT_LOAN', 'OUT_DAILY', 'OUT_ADJUSTMENT',
      'OUT_WASTE', 'OUT_PRODUCTION', 'OUT_PROCESSING', 'OUT_REVERSAL'
    ));

-- 2. Backfill: Update existing BREAKDOWN adjustment movements from OUT_WASTE → OUT_PROCESSING
-- Update ALL historical BREAKDOWN movements regardless of soft-delete status
UPDATE stock_movements sm
SET movement_type = 'OUT_PROCESSING'
WHERE sm.movement_type = 'OUT_WASTE'
  AND sm.reference_type = 'adjustment'
  AND sm.reference_id IN (
    SELECT id FROM stock_adjustments WHERE adjustment_type = 'BREAKDOWN'
  );
