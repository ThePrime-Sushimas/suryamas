BEGIN;

ALTER TABLE marketplace_checkout_lines
  ADD COLUMN IF NOT EXISTS correction_journal_id UUID
  REFERENCES journal_headers(id);

COMMIT;
