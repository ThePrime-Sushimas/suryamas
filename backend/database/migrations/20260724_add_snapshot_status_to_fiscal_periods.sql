-- Add snapshot_status to fiscal_periods to track closing snapshot lifecycle.
-- Allows retry without reopen when snapshot generation fails after period close.
--
-- Values:
--   NULL      = period not yet closed (or closed before snapshot feature existed)
--   PENDING   = period closed, snapshot generation in progress
--   COMPLETED = snapshot successfully created
--   FAILED    = snapshot generation failed, needs retry

ALTER TABLE fiscal_periods
  ADD COLUMN IF NOT EXISTS snapshot_status VARCHAR(20) DEFAULT NULL
  CHECK (snapshot_status IN ('PENDING', 'COMPLETED', 'FAILED'));

COMMENT ON COLUMN fiscal_periods.snapshot_status IS
  'Tracks closing snapshot lifecycle. NULL = not closed or pre-feature. PENDING/COMPLETED/FAILED for snapshot state.';
