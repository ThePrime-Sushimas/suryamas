-- Rekening tujuan supplier per Purchase Invoice dan AP Payment

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS supplier_bank_account_id INTEGER REFERENCES bank_accounts(id),
  ADD COLUMN IF NOT EXISTS supplier_bank_account_by UUID REFERENCES auth_users(id),
  ADD COLUMN IF NOT EXISTS supplier_bank_account_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pi_supplier_bank_account
  ON purchase_invoices(supplier_bank_account_id)
  WHERE supplier_bank_account_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE ap_payments
  ADD COLUMN IF NOT EXISTS supplier_bank_account_id INTEGER REFERENCES bank_accounts(id);

CREATE INDEX IF NOT EXISTS idx_ap_payments_supplier_bank
  ON ap_payments(supplier_bank_account_id)
  WHERE supplier_bank_account_id IS NOT NULL AND deleted_at IS NULL;
