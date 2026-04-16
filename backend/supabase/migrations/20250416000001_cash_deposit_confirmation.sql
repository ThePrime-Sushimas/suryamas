-- Add deposit confirmation fields for cash deposit → bank reconciliation flow
-- Status flow: PENDING → DEPOSITED → RECONCILED
ALTER TABLE cash_deposits
  ADD COLUMN IF NOT EXISTS proof_url text NULL,
  ADD COLUMN IF NOT EXISTS deposited_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deposited_by uuid NULL;

-- Index for auto-match: find DEPOSITED deposits by date + bank account
CREATE INDEX IF NOT EXISTS idx_cash_deposits_match
  ON cash_deposits (status, deposit_date, bank_account_id)
  WHERE deleted_at IS NULL;
