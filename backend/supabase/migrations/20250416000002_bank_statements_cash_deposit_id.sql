-- Add cash_deposit_id to bank_statements for cash deposit reconciliation tracing
-- reconciliation_id → aggregated_transactions (existing, untuk POS payment)
-- cash_deposit_id → cash_deposits (baru, untuk setoran tunai)
ALTER TABLE bank_statements
  ADD COLUMN IF NOT EXISTS cash_deposit_id uuid NULL;

ALTER TABLE bank_statements
  ADD CONSTRAINT fk_bank_statements_cash_deposit
  FOREIGN KEY (cash_deposit_id) REFERENCES cash_deposits (id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_statements_cash_deposit_id
  ON bank_statements (cash_deposit_id)
  WHERE cash_deposit_id IS NOT NULL;
