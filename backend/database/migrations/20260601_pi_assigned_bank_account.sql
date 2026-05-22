-- Add assigned_bank_account_id to purchase_invoices
-- Finance assigns which company bank account to use for payment.
-- This is persisted so admin can see the assignment later.

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS assigned_bank_account_id INTEGER REFERENCES bank_accounts(id),
  ADD COLUMN IF NOT EXISTS assigned_bank_account_by UUID REFERENCES auth_users(id),
  ADD COLUMN IF NOT EXISTS assigned_bank_account_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pi_assigned_bank_account
  ON purchase_invoices(assigned_bank_account_id)
  WHERE assigned_bank_account_id IS NOT NULL AND deleted_at IS NULL;
