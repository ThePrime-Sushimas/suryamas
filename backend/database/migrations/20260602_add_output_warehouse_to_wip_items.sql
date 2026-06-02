-- Add output_warehouse column to track where finished goods are stored
ALTER TABLE wip_items 
ADD COLUMN output_warehouse VARCHAR(50) DEFAULT 'READY' 
CHECK (output_warehouse IN ('READY', 'FINISHED_GOODS'));

-- Add output_product_id to track which product is created from finished goods
ALTER TABLE wip_items
ADD COLUMN output_product_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- Add comments for clarity
COMMENT ON COLUMN wip_items.output_warehouse IS 'Determines where finished goods from this WIP are stored. READY=branch kitchen, FINISHED_GOODS=central kitchen output';
COMMENT ON COLUMN wip_items.output_product_id IS 'Product that is created when FINISHED_GOODS is selected. Used for output tracking and stock IN_PRODUCTION movement';
