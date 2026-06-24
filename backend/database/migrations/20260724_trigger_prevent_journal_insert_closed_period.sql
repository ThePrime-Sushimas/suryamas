-- Migration: Add database-level trigger to prevent journal insert on closed fiscal periods.
--
-- Defense in depth: application-level guards (isFiscalPeriodOpen) already exist in each module,
-- but this trigger catches any bypass (new module that forgets the check, direct SQL, etc.)
--
-- Exceptions:
--   1. source_module = 'FISCAL_CLOSING' — closing journal is inserted during the closing process
--      (period is still open at INSERT time, but exception exists for safety against future refactors)
--   2. No matching fiscal_period row — allow (period might not be created yet)
--
-- Scope: INSERT only (not UPDATE, not DELETE)

CREATE OR REPLACE FUNCTION prevent_journal_insert_on_closed_period()
RETURNS TRIGGER AS $$
DECLARE
  v_is_open BOOLEAN;
BEGIN
  -- Exception: fiscal closing journals are allowed (they're part of the closing process itself)
  IF NEW.source_module = 'FISCAL_CLOSING' THEN
    RETURN NEW;
  END IF;

  -- Lookup fiscal period by company_id + period (direct match via journal_headers.period column)
  SELECT fp.is_open INTO v_is_open
  FROM fiscal_periods fp
  WHERE fp.company_id = NEW.company_id
    AND fp.period = NEW.period
    AND fp.deleted_at IS NULL
  LIMIT 1;

  -- If no matching fiscal period exists, allow (period not yet created by accountant)
  IF v_is_open IS NULL THEN
    RETURN NEW;
  END IF;

  -- If period is closed, reject the insert
  IF v_is_open = FALSE THEN
    RAISE EXCEPTION 'Tidak bisa membuat journal di periode % yang sudah ditutup (journal_date: %, company_id: %)',
      NEW.period, NEW.journal_date, NEW.company_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to journal_headers (BEFORE INSERT, per row)
DROP TRIGGER IF EXISTS trg_prevent_journal_insert_on_closed_period ON journal_headers;

CREATE TRIGGER trg_prevent_journal_insert_on_closed_period
  BEFORE INSERT ON journal_headers
  FOR EACH ROW
  EXECUTE FUNCTION prevent_journal_insert_on_closed_period();

-- Add a comment for documentation
COMMENT ON FUNCTION prevent_journal_insert_on_closed_period() IS
  'Prevents inserting journal entries into fiscal periods that have been closed (is_open = false). '
  'Exceptions: source_module = FISCAL_CLOSING (part of closing process), no matching fiscal_period row (period not yet created). '
  'See: backend/database/migrations/20260724_trigger_prevent_journal_insert_closed_period.sql';
