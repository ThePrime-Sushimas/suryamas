-- Fix: closing_journal_id FK must be ON DELETE SET NULL
-- so that reopenPeriod() can hard-delete the closing journal
-- without FK violation from fiscal_period_closing_snapshots.
--
-- The snapshot itself remains intact (immutable data preserved),
-- only the journal reference becomes NULL after reopen.
--
-- Also update the immutability trigger to allow closing_journal_id changes
-- (since ON DELETE SET NULL fires an UPDATE internally).

ALTER TABLE fiscal_period_closing_snapshots
  DROP CONSTRAINT IF EXISTS fiscal_period_closing_snapshots_closing_journal_id_fkey;

ALTER TABLE fiscal_period_closing_snapshots
  ADD CONSTRAINT fiscal_period_closing_snapshots_closing_journal_id_fkey
  FOREIGN KEY (closing_journal_id) REFERENCES journal_headers(id)
  ON DELETE SET NULL;

-- Update immutability trigger: allow is_latest to change freely,
-- closing_journal_id can ONLY change to NULL (not to a different value)
CREATE OR REPLACE FUNCTION enforce_closing_snapshot_header_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- closing_journal_id may only be NULLed (by ON DELETE SET NULL), not changed to another value
  IF NEW.closing_journal_id IS NOT NULL AND NEW.closing_journal_id IS DISTINCT FROM OLD.closing_journal_id THEN
    RAISE EXCEPTION 'fiscal_period_closing_snapshots: closing_journal_id can only be set to NULL, not changed to another value'
      USING ERRCODE = 'P0001';
  END IF;

  -- All other columns (except is_latest and closing_journal_id) must be unchanged
  IF (to_jsonb(NEW) - 'is_latest' - 'closing_journal_id') IS DISTINCT FROM (to_jsonb(OLD) - 'is_latest' - 'closing_journal_id') THEN
    RAISE EXCEPTION 'fiscal_period_closing_snapshots is immutable except for is_latest and closing_journal_id (NULL only) columns'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
