-- ============================================================
-- Migration: AP Payment Batches
-- Bulk payment batch tracking for AP Payments module
-- ============================================================

-- 1. Create ap_payment_batches table
CREATE TABLE ap_payment_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      UUID NOT NULL REFERENCES auth_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_payments  INTEGER NOT NULL CHECK (total_payments > 0),
  total_amount    NUMERIC(15,2) NOT NULL CHECK (total_amount > 0),
  notes           TEXT
);

CREATE INDEX idx_ap_payment_batches_created_by
  ON ap_payment_batches(created_by);

-- 2. Add bulk_payment_batch_id column to ap_payments
ALTER TABLE ap_payments
  ADD COLUMN bulk_payment_batch_id UUID
    REFERENCES ap_payment_batches(id) ON DELETE SET NULL;

CREATE INDEX idx_ap_payments_bulk_batch
  ON ap_payments(bulk_payment_batch_id)
  WHERE bulk_payment_batch_id IS NOT NULL;

-- 3. Ensure bank_accounts module exists in perm_modules for view_balance permission
INSERT INTO perm_modules (name, description, is_active)
VALUES ('bank_accounts', 'Bank Account Management', true)
ON CONFLICT (name) DO NOTHING;
