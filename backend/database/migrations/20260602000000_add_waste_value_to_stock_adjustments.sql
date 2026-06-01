-- Add waste_value column to preserve journal amount for manual retry
ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS waste_value NUMERIC(20,4) NOT NULL DEFAULT 0;

-- Create index for audit
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_waste_value ON stock_adjustments(waste_value) WHERE waste_value > 0 AND deleted_at IS NULL;
