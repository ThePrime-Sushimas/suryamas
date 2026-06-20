-- Asset Opening Balance: add OPENING_BALANCE to movement_type CHECK constraint
-- Enables recording assets that existed before the system was deployed

BEGIN;

-- Drop existing CHECK constraint on movement_type and recreate with new value
ALTER TABLE asset_movements
  DROP CONSTRAINT IF EXISTS asset_movements_movement_type_check;

ALTER TABLE asset_movements
  ADD CONSTRAINT asset_movements_movement_type_check
    CHECK (movement_type IN (
      'CAPITALIZE', 'DEPRECIATION', 'TRANSFER',
      'MAINTENANCE', 'MAINTENANCE_COMPLETE',
      'DISPOSAL', 'COST_ADJUSTMENT',
      'OPENING_BALANCE'
    ));

COMMIT;
