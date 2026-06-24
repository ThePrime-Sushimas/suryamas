-- Fix Blocker 1: Race condition on getNextVersion
-- Fix Blocker 2: Unique constraint for is_latest = true
-- Fix Medium 1: Prevent DELETE on snapshots (true immutability)

-- ============================================================
-- Blocker 2: Unique partial index ensures at most 1 latest per period
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_snapshot_latest_per_period
  ON fiscal_period_closing_snapshots(fiscal_period_id)
  WHERE is_latest = true;

-- ============================================================
-- Medium 1: Prevent DELETE on all snapshot tables
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_closing_snapshot_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Closing snapshots are immutable — DELETE is not allowed. Use reopen workflow instead.'
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

-- Header table: prevent delete
DROP TRIGGER IF EXISTS trg_prevent_snapshot_header_delete ON fiscal_period_closing_snapshots;
CREATE TRIGGER trg_prevent_snapshot_header_delete
  BEFORE DELETE ON fiscal_period_closing_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION prevent_closing_snapshot_delete();

-- Child tables: prevent delete (CASCADE from header is also blocked by header trigger)
DROP TRIGGER IF EXISTS trg_prevent_tb_line_delete ON closing_snapshot_trial_balance_lines;
CREATE TRIGGER trg_prevent_tb_line_delete
  BEFORE DELETE ON closing_snapshot_trial_balance_lines
  FOR EACH ROW
  EXECUTE FUNCTION prevent_closing_snapshot_delete();

DROP TRIGGER IF EXISTS trg_prevent_is_line_delete ON closing_snapshot_income_statement_lines;
CREATE TRIGGER trg_prevent_is_line_delete
  BEFORE DELETE ON closing_snapshot_income_statement_lines
  FOR EACH ROW
  EXECUTE FUNCTION prevent_closing_snapshot_delete();

DROP TRIGGER IF EXISTS trg_prevent_bs_line_delete ON closing_snapshot_balance_sheet_lines;
CREATE TRIGGER trg_prevent_bs_line_delete
  BEFORE DELETE ON closing_snapshot_balance_sheet_lines
  FOR EACH ROW
  EXECUTE FUNCTION prevent_closing_snapshot_delete();

COMMENT ON FUNCTION prevent_closing_snapshot_delete() IS
  'Prevents deletion of closing snapshots. Data is permanently archived for audit trail.';
