-- Update warehouse_type CHECK constraint to include FINISHED_GOODS
-- First, drop the existing constraint if it exists
ALTER TABLE warehouses 
DROP CONSTRAINT IF EXISTS warehouses_warehouse_type_check;

-- Add the new constraint with only 3 allowed types
ALTER TABLE warehouses 
ADD CONSTRAINT warehouses_warehouse_type_check 
CHECK (warehouse_type IN ('MAIN', 'READY', 'FINISHED_GOODS'));

-- Migrate existing CENTRAL_STOCK → MAIN, CENTRAL_KITCHEN → MAIN
UPDATE warehouses SET warehouse_type = 'MAIN' WHERE warehouse_type IN ('CENTRAL_STOCK', 'CENTRAL_KITCHEN');

-- Add comment
COMMENT ON CONSTRAINT warehouses_warehouse_type_check ON warehouses IS 'Allowed warehouse types: MAIN (central/utama), READY (branch active/siap pakai), FINISHED_GOODS (central production output)';
