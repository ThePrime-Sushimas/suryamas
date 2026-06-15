-- Stock Adjustment: trace shortage opname source for V1.5 journal DR grouping

ALTER TABLE stock_adjustments
  ADD COLUMN IF NOT EXISTS source_closing_id UUID REFERENCES daily_closing_counts(id),
  ADD COLUMN IF NOT EXISTS source_position_id UUID REFERENCES positions(id);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_source_closing
  ON stock_adjustments(source_closing_id)
  WHERE source_closing_id IS NOT NULL AND deleted_at IS NULL;
