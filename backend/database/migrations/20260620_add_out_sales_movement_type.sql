-- Migration: Add OUT_SALES movement type + change reference_id to TEXT
-- Purpose: Allow stock OUT_SALES movements for WIP output when POS sells menu items
-- This enables accurate opname variance for WIP finished goods

-- 1. Alter reference_id from UUID to TEXT to support sales_num references
ALTER TABLE stock_movements
  ALTER COLUMN reference_id TYPE TEXT;

-- 2. Drop and recreate the index (needed after type change)
DROP INDEX IF EXISTS idx_stock_movements_reference;
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- 3. Extend movement_type CHECK constraint to include OUT_SALES
ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_movement_type_check
    CHECK (movement_type IN (
      'IN_PURCHASE', 'IN_TRANSFER', 'IN_RETURN', 'IN_PRODUCTION',
      'IN_ADJUSTMENT', 'IN_OPENING', 'IN_REVERSAL',
      'OUT_TRANSFER', 'OUT_LOAN', 'OUT_DAILY', 'OUT_ADJUSTMENT',
      'OUT_WASTE', 'OUT_PRODUCTION', 'OUT_REVERSAL',
      'OUT_SALES'
    ));

-- 4. Add index for idempotency check: quickly find existing OUT_SALES for a given sales_num
CREATE INDEX IF NOT EXISTS idx_stock_movements_pos_sync
  ON stock_movements(reference_type, reference_id, product_id, warehouse_id)
  WHERE reference_type = 'pos_sync';
