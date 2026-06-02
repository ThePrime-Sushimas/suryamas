-- Add stock movement tracking columns to production_order_materials
ALTER TABLE production_order_materials 
ADD COLUMN stock_movement_out_id UUID REFERENCES stock_movements(id) ON DELETE SET NULL;

ALTER TABLE production_order_materials 
ADD COLUMN stock_movement_in_id UUID REFERENCES stock_movements(id) ON DELETE SET NULL;

-- Add comments
COMMENT ON COLUMN production_order_materials.stock_movement_out_id IS 'References the OUT_PRODUCTION stock movement when materials are deducted from warehouse';
COMMENT ON COLUMN production_order_materials.stock_movement_in_id IS 'References the IN_PRODUCTION stock movement for finished goods output (if applicable)';

-- Create indexes for audit trail lookups
CREATE INDEX idx_production_order_materials_out_movement 
ON production_order_materials(stock_movement_out_id) 
WHERE stock_movement_out_id IS NOT NULL;

CREATE INDEX idx_production_order_materials_in_movement 
ON production_order_materials(stock_movement_in_id) 
WHERE stock_movement_in_id IS NOT NULL;
