-- Marketplace checkout lines: per-line status for partial cancel / platform transfer
BEGIN;

ALTER TABLE marketplace_checkout_lines
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mcl_status_check'
  ) THEN
    ALTER TABLE marketplace_checkout_lines
      ADD CONSTRAINT mcl_status_check
      CHECK (status IN ('ACTIVE', 'CANCELLED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mcl_status
  ON marketplace_checkout_lines (status)
  WHERE status = 'ACTIVE';

COMMIT;
