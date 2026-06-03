-- ============================================================================
-- Add position_id to daily_closing_counts
-- Allows multiple opname sessions per branch per date (one per position)
-- Also removes time restriction for manual date input (backdate support)
-- ============================================================================

-- 1. Add position_id column
ALTER TABLE daily_closing_counts
  ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES positions(id);

-- 2. Drop old unique index (branch_id, closing_date)
DROP INDEX IF EXISTS idx_closing_counts_branch_date;

-- 3. Create new unique index (branch_id, closing_date, position_id)
--    Using is_deleted = false to match repository query patterns
CREATE UNIQUE INDEX IF NOT EXISTS idx_closing_counts_branch_date_position
  ON daily_closing_counts(branch_id, closing_date, position_id)
  WHERE is_deleted = false;

-- 4. Add index on position_id for filtering
CREATE INDEX IF NOT EXISTS idx_closing_counts_position
  ON daily_closing_counts(position_id)
  WHERE is_deleted = false;
