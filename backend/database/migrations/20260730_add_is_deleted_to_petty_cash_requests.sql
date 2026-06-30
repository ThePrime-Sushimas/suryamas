-- Add is_deleted column to petty_cash_requests for soft delete support
-- Existing pattern: SET deleted_at = NOW(), is_deleted = true

BEGIN;

ALTER TABLE petty_cash_requests
  ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Back-fill existing deleted rows
UPDATE petty_cash_requests
SET is_deleted = true
WHERE deleted_at IS NOT NULL;

COMMIT;